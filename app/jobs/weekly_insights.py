"""周一执行：SerpAPI price_insights 冷启动基线校准（§8，FR-ING-05）。

对每条航线取下月 15 日为探测日，调 price_insights；写入该航线下三个月 × 全部 lead_bucket
的 coldstart 行（sample_n=0, low_confidence=True）。需 SERPAPI_KEY；缺则各航线降级跳过。
"""
import calendar
import logging
from datetime import date

from app.baseline.engine import derive_coldstart, upsert_coldstart
from app.db import load_enabled_routes
from app.notify.feishu import notify_ops
from app.providers.chain import AllProvidersFailed, ProviderChain
from app.settings import load_config, today_sgt

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fareradar.weekly_insights")

_BUCKETS = ["L0", "L1", "L2"]


def _add_months(d: date, n: int) -> date:
    m = d.month - 1 + n
    year = d.year + m // 12
    month = m % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def main() -> None:
    cfg = load_config()
    chain = ProviderChain(cfg)
    routes = load_enabled_routes()
    today = today_sgt()
    factor = cfg.alerts.coldstart_factor

    for route in routes:
        probe = _add_months(today.replace(day=15), 1)     # 下月 15 日
        try:
            pi = chain.price_insights(route.origin, route.dest, probe)
        except AllProvidersFailed as e:
            notify_ops(f"price_insights 失败 {route.id}: {e}")
            continue
        derived = derive_coldstart(pi["range_low"], pi["range_high"], factor)
        for k in range(1, 4):                             # 下三个月
            month = _add_months(today, k).strftime("%Y-%m")
            for bucket in _BUCKETS:
                upsert_coldstart(route.id, month, bucket, derived)
        log.info("coldstart %s: low=%.0f high=%.0f", route.id, pi["range_low"], pi["range_high"])

    chain.flush_ops_log()


if __name__ == "__main__":
    main()
