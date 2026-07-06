"""预算管理与降级链（§6.5）。

calendar 链: [fli, fast_flights]        # serpapi 无区间能力
details  链: [fli, fast_flights, serpapi]

规则：
  1) 逐级尝试；ProviderUnavailable → 永久跳过本进程内该级
  2) ProviderError → 该级失败计数 +1；连续 >= fail_threshold 次 → 本次运行内降级
  3) 每次真实请求前检查 provider_usage 当日预算（serpapi 另查当月合计 < serpapi_monthly_cap），
     超限 → 视同本级不可用
  4) 每次请求后 UPSERT provider_usage、累计 ops_log(requests/ok/degraded/failed)
  5) 全链失败 → 抛 AllProvidersFailed，由 job 捕获并发运维卡（不中断其余航线）
降级发生时立即推运维卡（FR-NTF-05）。
"""
import logging
from collections import defaultdict

from app.db import execute, query_one
from app.notify.feishu import notify_ops

from .base import ProviderError, ProviderUnavailable

log = logging.getLogger("fareradar.chain")

CALENDAR_ORDER = ["fli", "fast_flights"]
DETAILS_ORDER = ["fli", "fast_flights", "serpapi"]


class AllProvidersFailed(Exception):
    """calendar/details 全链失败。"""


def _usage_today(provider: str) -> int:
    r = query_one(
        "SELECT COALESCE(used,0) AS used FROM provider_usage "
        "WHERE provider = %(p)s AND day = CURRENT_DATE", {"p": provider})
    return int(r["used"]) if r else 0


def _usage_month(provider: str) -> int:
    r = query_one(
        "SELECT COALESCE(SUM(used),0) AS s FROM provider_usage "
        "WHERE provider = %(p)s AND day >= date_trunc('month', CURRENT_DATE)", {"p": provider})
    return int(r["s"]) if r else 0


def _incr_usage(provider: str) -> None:
    execute(
        "INSERT INTO provider_usage (provider, day, used) VALUES (%(p)s, CURRENT_DATE, 1) "
        "ON CONFLICT (provider, day) DO UPDATE SET used = provider_usage.used + 1",
        {"p": provider})


class ProviderChain:
    def __init__(self, cfg):
        self.cfg = cfg
        self.currency = cfg.currency
        self.cabin = cfg.cabin
        self.pax = cfg.pax
        db = cfg.providers.daily_budget
        self.daily_budget = {"fli": db.fli, "fast_flights": db.fast_flights, "serpapi": db.serpapi}
        self.serpapi_monthly_cap = cfg.providers.serpapi_monthly_cap
        self.fail_threshold = cfg.providers.fail_threshold
        self._providers: dict[str, object | None] = {}
        self._degraded: set[str] = set()
        self._fail: dict[str, int] = defaultdict(int)
        self.ops = defaultdict(lambda: {"requests": 0, "ok": 0, "degraded": 0, "failed": 0})
        self.last_provider: str | None = None   # 最近一次成功服务的源（入库 provider 字段用）

    # ---------------------------------------------------------- provider ----
    def _construct(self, name: str):
        if name == "fli":
            from .fli_provider import FliProvider
            return FliProvider(self.currency, self.cabin, self.pax)
        if name == "fast_flights":
            from .fastflights_provider import FastFlightsProvider
            return FastFlightsProvider(self.currency, self.cabin, self.pax)
        if name == "serpapi":
            from .serpapi_provider import SerpApiProvider
            return SerpApiProvider(self.currency, self.cabin, self.pax)
        raise ProviderUnavailable(f"unknown provider {name}")

    def get_provider(self, name: str):
        """惰性构造并缓存；ProviderUnavailable → 缓存 None（永久跳过）。"""
        if name not in self._providers:
            try:
                self._providers[name] = self._construct(name)
            except ProviderUnavailable as e:
                log.warning("provider %s unavailable: %s", name, e)
                self._providers[name] = None
        return self._providers[name]

    def _budget_ok(self, name: str) -> bool:
        if _usage_today(name) >= self.daily_budget[name]:
            log.warning("provider %s 当日预算耗尽", name)
            return False
        if name == "serpapi" and _usage_month("serpapi") >= self.serpapi_monthly_cap:
            log.warning("serpapi 当月预算耗尽")
            return False
        return True

    def _degrade(self, name: str, reason: str) -> None:
        self._degraded.add(name)
        self.ops[name]["degraded"] += 1
        notify_ops(f"数据源降级：**{name}** 连续失败 {self.fail_threshold} 次，切换下一级。原因：{reason}")

    def _try_level(self, name: str, method: str, args: tuple):
        prov = self.get_provider(name)
        if prov is None or name in self._degraded:
            return None, False
        if not self._budget_ok(name):
            return None, False
        self.ops[name]["requests"] += 1
        _incr_usage(name)
        try:
            result = getattr(prov, method)(*args)
            self.ops[name]["ok"] += 1
            self._fail[name] = 0
            self.last_provider = name
            return result, True
        except ProviderError as e:
            self.ops[name]["failed"] += 1
            self._fail[name] += 1
            log.warning("provider %s %s failed: %s", name, method, e)
            if self._fail[name] >= self.fail_threshold:
                self._degrade(name, str(e))
            return None, False

    def _run_chain(self, order: list[str], method: str, args: tuple):
        for name in order:
            result, ok = self._try_level(name, method, args)
            if ok:
                return result
        raise AllProvidersFailed(f"{method} 全链失败 ({', '.join(order)})")

    # -------------------------------------------------------------- public --
    def calendar(self, origin, dest, date_from, date_to, trip_type, stay_rep):
        return self._run_chain(
            CALENDAR_ORDER, "calendar",
            (origin, dest, date_from, date_to, trip_type, stay_rep))

    def details(self, origin, dest, depart_date, return_date):
        return self._run_chain(
            DETAILS_ORDER, "details", (origin, dest, depart_date, return_date))

    def price_insights(self, origin, dest, probe_date):
        """冷启动专用：仅 serpapi。"""
        prov = self.get_provider("serpapi")
        if prov is None:
            raise AllProvidersFailed("serpapi unavailable for price_insights")
        if not self._budget_ok("serpapi"):
            raise AllProvidersFailed("serpapi budget exhausted")
        self.ops["serpapi"]["requests"] += 1
        _incr_usage("serpapi")
        try:
            r = prov.price_insights(origin, dest, probe_date)
            self.ops["serpapi"]["ok"] += 1
            return r
        except ProviderError as e:
            self.ops["serpapi"]["failed"] += 1
            raise AllProvidersFailed(str(e))

    # --------------------------------------------------------------- ops ----
    def serpapi_month_used(self) -> int:
        return _usage_month("serpapi")

    def flush_ops_log(self) -> None:
        for provider, c in self.ops.items():
            execute(
                "INSERT INTO ops_log (day, provider, requests, ok, degraded, failed) "
                "VALUES (CURRENT_DATE, %(p)s, %(req)s, %(ok)s, %(deg)s, %(fail)s) "
                "ON CONFLICT (day, provider) DO UPDATE SET "
                "  requests = ops_log.requests + EXCLUDED.requests, "
                "  ok = ops_log.ok + EXCLUDED.ok, "
                "  degraded = ops_log.degraded + EXCLUDED.degraded, "
                "  failed = ops_log.failed + EXCLUDED.failed",
                {"p": provider, "req": c["requests"], "ok": c["ok"],
                 "deg": c["degraded"], "fail": c["failed"]})
        self.ops.clear()
