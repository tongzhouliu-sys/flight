"""采价编排的采集段（§7 步骤 1、3）：日历扫（原始 + HKG 影子）、钻取候选、入库。

约束：try 粒度 = 航线；单航线异常不中断主循环（由 daily_scan 保证）。
"""
import logging
from dataclasses import dataclass
from datetime import date

from app.db import Route, executemany, latest_calendar

log = logging.getLogger("fareradar.scanner")

INSERT_SNAPSHOT = """
INSERT INTO price_snapshot
  (route_id, variant, depart_date, return_date, price, currency,
   carrier, stops, depart_time, arrive_time, is_calendar, provider)
VALUES
  (%(route_id)s, %(variant)s, %(depart_date)s, %(return_date)s, %(price)s, %(currency)s,
   %(carrier)s, %(stops)s, %(depart_time)s, %(arrive_time)s, %(is_calendar)s, %(provider)s)
"""


@dataclass(frozen=True)
class DrillCandidate:
    depart_date: date
    return_date: date | None
    price: float


# ------------------------------------------------------------ HKG 影子替换 ---

def substitute_hkg(route: Route, variant: str | None) -> tuple[str, str]:
    """把航线 HKG 一端替换为 variant 机场码；variant=None 返回原始 (origin, dest)。"""
    if variant is None:
        return route.origin, route.dest
    if route.origin == "HKG":
        return variant, route.dest
    if route.dest == "HKG":
        return route.origin, variant
    # 无 HKG 端却配了 nearby（配置异常）→ 保守返回原始
    log.warning("route %s 无 HKG 端，忽略 variant %s", route.id, variant)
    return route.origin, route.dest


# ------------------------------------------------------------------ 入库 -----

def insert_calendar_snapshots(route_id, variant, points, provider) -> int:
    rows = [{
        "route_id": route_id, "variant": variant,
        "depart_date": p.depart_date, "return_date": p.return_date,
        "price": p.price, "currency": p.currency,
        "carrier": None, "stops": None, "depart_time": None, "arrive_time": None,
        "is_calendar": True, "provider": provider,
    } for p in points]
    executemany(INSERT_SNAPSHOT, rows)
    return len(rows)


def insert_detail_snapshots(route_id, cand: DrillCandidate, options, provider) -> int:
    rows = [{
        "route_id": route_id, "variant": None,
        "depart_date": cand.depart_date, "return_date": cand.return_date,
        "price": o.price, "currency": o.currency,
        "carrier": o.carrier, "stops": o.stops,
        "depart_time": o.depart_time, "arrive_time": o.arrive_time,
        "is_calendar": False, "provider": provider,
    } for o in options]
    executemany(INSERT_SNAPSHOT, rows)
    return len(rows)


# ----------------------------------------------------------- 钻取候选选取 ----

def _pct_fraction(name: str) -> float:
    # "p25" → 0.25
    return int(name.lstrip("pP")) / 100.0


def _percentile(values: list[float], frac: float) -> float:
    """线性插值分位（与 numpy 'linear' 一致），values 非空。"""
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    idx = frac * (len(s) - 1)
    lo = int(idx)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (s[hi] - s[lo]) * (idx - lo)


def breach_candidates(route: Route, currency: str, drill_trigger: str, limit: int) -> list[DrillCandidate]:
    """当前日历（variant IS NULL）中价格低于 drill_trigger 分位的最便宜 limit 个日期。"""
    rows = latest_calendar(route.id, currency, variant=None)
    prices = [float(r["price"]) for r in rows]
    if len(prices) < 4:            # 样本太少无意义
        return []
    threshold = _percentile(prices, _pct_fraction(drill_trigger))
    below = [r for r in rows if float(r["price"]) < threshold]
    below.sort(key=lambda r: float(r["price"]))
    return [DrillCandidate(depart_date=r["depart_date"], return_date=r["return_date"],
                           price=float(r["price"])) for r in below[:limit]]
