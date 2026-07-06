"""周日 20:00 SGT 周报（§6.5 FR-NTF-04，模板 C）。

三段：各航线价格水位、本周被限流的 queued_weekly 机会、系统健康摘要（UAT-08）。
"""
import logging

from app.baseline.engine import lead_bucket, resolve_baseline_db
from app.db import latest_calendar, load_enabled_routes, query, query_one
from app.notify.cards import build_weekly_card
from app.notify.feishu import push_card
from app.settings import currency_symbol, load_config, today_sgt
from app.signals.alerts import _week_start_utc

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("fareradar.weekly_report")


def _position(minp, base) -> str:
    if base is None or base.p25 is None:
        return "无基线"
    if minp < float(base.p25):
        return "低于 P25（便宜）"
    if base.p50 is not None and minp <= float(base.p50):
        return "P25~P50"
    return ">P50（偏贵）"


def _levels_section(cfg) -> str:
    s = currency_symbol(cfg.currency)
    lines = []
    for route in load_enabled_routes():
        rows = latest_calendar(route.id, cfg.currency)
        if not rows:
            lines.append(f"{route.id} {route.origin}-{route.dest}：无数据")
            continue
        best = min(rows, key=lambda r: float(r["price"]))
        minp = float(best["price"])
        d0 = best["depart_date"]
        bucket = lead_bucket(d0, today_sgt(), vars(cfg.baseline.lead_buckets))
        base = resolve_baseline_db(route.id, d0.strftime("%Y-%m"), bucket, cfg.baseline.min_sample)
        lines.append(f"{route.id} {route.origin}-{route.dest}：60天最低 {s}{minp:.0f} ｜ {_position(minp, base)}")
    return "\n".join(lines)


def _queued_section(cfg) -> str:
    s = currency_symbol(cfg.currency)
    rows = query(
        "SELECT o.route_id, o.type, o.depart_date, o.saving "
        "FROM alert a JOIN opportunity o ON o.id = a.opportunity_id "
        "WHERE a.status = 'queued_weekly' AND a.sent_at >= %(ws)s "
        "ORDER BY o.saving DESC LIMIT 20", {"ws": _week_start_utc()})
    if not rows:
        return "本周无被限流机会"
    return "\n".join(
        f"{r['route_id']} {r['type']} {r['depart_date']} 省 {s}{float(r['saving']):.0f}" for r in rows)


def _health_section(cfg) -> str:
    s = currency_symbol(cfg.currency)
    ops = query_one("SELECT COALESCE(SUM(requests),0) AS req, COALESCE(SUM(ok),0) AS ok "
                    "FROM ops_log WHERE day >= CURRENT_DATE - 30")
    rate = (ops["ok"] / ops["req"] * 100) if ops and ops["req"] else 0.0
    budgets = []
    for p, b in vars(cfg.providers.daily_budget).items():
        u = query_one("SELECT COALESCE(used,0) AS u FROM provider_usage WHERE provider=%(p)s AND day=CURRENT_DATE",
                      {"p": p})
        budgets.append(f"{p} {b - (u['u'] if u else 0)}/{b}")
    lowconf = query_one("SELECT count(*) AS c FROM baseline WHERE low_confidence")
    annual = query_one("SELECT COALESCE(SUM(saving),0) AS s FROM purchase "
                       "WHERE purchased_at >= date_trunc('year', now())")
    return (f"30天成功率：{rate:.0f}%\n"
            f"今日预算余量：{' ｜ '.join(budgets)}\n"
            f"低置信度基线：{lowconf['c'] if lowconf else 0} 格\n"
            f"年度累计节省：{s}{float(annual['s']) if annual else 0:.0f}")


def main() -> None:
    cfg = load_config()
    card = build_weekly_card(_levels_section(cfg), _queued_section(cfg), _health_section(cfg))
    push_card(card)
    log.info("weekly_report 已生成")


if __name__ == "__main__":
    main()
