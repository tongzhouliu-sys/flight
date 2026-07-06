"""每日采价主编排（§7）：采集 → 基线 → 信号 → 告警。

按 Tech Spec 任务序列分步接入：T3 采集段（日历扫 + 钻取 + 入库 + 收尾）；
T4 在采集后接入基线重算；T5 接入信号→风险→告警。
单次运行 try 粒度 = 航线，单航线异常不中断主循环；总时限由 workflow timeout 兜底。
"""
import logging
from datetime import timedelta

from app.baseline.engine import recompute_self_baselines
from app.db import load_enabled_routes
from app.ingestion.scanner import (breach_candidates, insert_calendar_snapshots,
                                    insert_detail_snapshots, substitute_hkg)
from app.notify.feishu import notify_ops
from app.providers.chain import AllProvidersFailed, ProviderChain
from app.settings import load_config, today_sgt
from app.signals.alerts import dispatch_alerts
from app.signals.engine import run_rules

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fareradar.daily_scan")


def collect(cfg, chain: ProviderChain, routes) -> None:
    """步骤 1 日历扫（原始 + HKG 影子） + 步骤 3 钻取。"""
    today = today_sgt()
    horizon = today + timedelta(days=cfg.scan.horizon_days)

    # 1) 日历扫（原始 + HKG 影子）
    for r in routes:
        scan_targets = [(r, None)] + [(r, v) for v in r.nearby_airports]
        for route, variant in scan_targets:
            o, d = substitute_hkg(route, variant)
            try:
                pts = chain.calendar(o, d, today, horizon, route.trip_type, route.stay_rep)
            except AllProvidersFailed as e:
                notify_ops(f"日历扫失败 {route.id}/{variant or '-'}: {e}")
                continue
            n = insert_calendar_snapshots(route.id, variant, pts, chain.last_provider)
            log.info("calendar %s/%s: %d 点 via %s", route.id, variant or "-", n, chain.last_provider)

    # 3) 钻取：每航线取当前日历中低于 drill_trigger 分位的前 drill_top_n 个日期
    for r in routes:
        for cand in breach_candidates(r, cfg.currency, cfg.scan.drill_trigger, cfg.scan.drill_top_n):
            try:
                opts = chain.details(r.origin, r.dest, cand.depart_date, cand.return_date)
            except AllProvidersFailed:
                continue                       # 日历价仍可用于 L1 信号
            n = insert_detail_snapshots(r.id, cand, opts, chain.last_provider)
            log.info("drill %s %s: %d 详情 via %s", r.id, cand.depart_date, n, chain.last_provider)


def main() -> None:
    cfg = load_config()
    routes = load_enabled_routes()
    chain = ProviderChain(cfg)

    # 1) 日历扫 + 3) 钻取
    collect(cfg, chain, routes)

    # 2) 基线重算（§8）
    n_base = recompute_self_baselines(cfg)
    log.info("baseline: %d (route, month, bucket) 格重算", n_base)

    # 4) 信号 → 风险 → 告警（§9）
    drafts = run_rules(cfg, ["baseline_breach", "date_shift", "nearby_airport"])
    tally = dispatch_alerts(cfg, drafts)
    log.info("signals: %d drafts, dispatch=%s", len(drafts), tally)

    # 5) 收尾
    chain.flush_ops_log()
    cap = cfg.providers.serpapi_monthly_cap
    if chain.serpapi_month_used() >= 0.8 * cap:
        notify_ops("SerpAPI 月预算已用 80%")


if __name__ == "__main__":
    main()
