"""飞书指令集（§11.3）：/fare /watch /bought /mute /status，正则解析、无大模型。

均为快速 DB 查询（飞书要求 3 秒内响应），无外呼。
"""
import re
from datetime import date, timedelta

from app.baseline.engine import grid_stats, lead_bucket, resolve_baseline_db
from app.db import (execute, execute_returning, find_route, get_route,
                    latest_calendar, query, query_one)
from app.notify.cards import sym
from app.settings import load_config, now_sgt, today_sgt

HELP = (
    "FareRadar 指令：\n"
    "/fare SIN WUH [2026-08]  查看航线价格日历\n"
    "/watch SIN WUH 2026-08-21 ±3  登记盯价\n"
    "/bought <alert_id> <价格>  登记已购\n"
    "/mute R1 7  静音航线 N 天\n"
    "/status  系统健康摘要"
)


def _available_routes() -> str:
    rs = query("SELECT id, origin, dest FROM route WHERE enabled ORDER BY id")
    return "、".join(f"{r['origin']}-{r['dest']}" for r in rs)


def _resolve_route_token(token: str):
    if re.fullmatch(r"R\d+", token):
        return get_route(token)
    m = re.fullmatch(r"([A-Z]{3})-([A-Z]{3})", token)
    if m:
        return find_route(m.group(1), m.group(2))
    return None


# ------------------------------------------------------------- /fare -------

def cmd_fare(m: re.Match) -> str:
    o, d, month = m.group(1), m.group(2), m.group(3)
    route = find_route(o, d)
    if not route:
        return f"未找到航线 {o}-{d}。可用航线：{_available_routes()}"
    cfg = load_config()
    s = sym(cfg.currency)
    rows = latest_calendar(route.id, cfg.currency)
    if month:
        rows = [r for r in rows if r["depart_date"].strftime("%Y-%m") == month]
    if not rows:
        return f"{o}-{d} 暂无近期采价数据"
    rows.sort(key=lambda r: float(r["price"]))
    low5 = rows[:5]
    lines = [f"  {r['depart_date']} {s}{float(r['price']):.0f}" for r in low5]
    lowest = rows[0]
    d0 = lowest["depart_date"]
    bucket = lead_bucket(d0, today_sgt(), vars(cfg.baseline.lead_buckets))
    stats = grid_stats(cfg, route.id, d0.strftime("%Y-%m"), bucket, float(lowest["price"]))
    pct = f"P{stats['pct']}" if stats["pct"] is not None else "—"
    span = f"（{month}）" if month else "（未来60天）"
    return (f"{o}→{d} 价格日历{span} 最低5天：\n" + "\n".join(lines) +
            f"\n最低 {s}{float(lowest['price']):.0f}，当前分位 {pct}")


# ------------------------------------------------------------- /watch ------

def cmd_watch(m: re.Match) -> str:
    o, d, center, flex = m.group(1), m.group(2), m.group(3), int(m.group(4))
    route = find_route(o, d)
    if not route:
        return f"未找到航线 {o}-{d}。可用航线：{_available_routes()}"
    cfg = load_config()
    s = sym(cfg.currency)
    center_date = date.fromisoformat(center)
    execute_returning(
        "INSERT INTO trip_intent (route_id, date_center, flex_days, pax) "
        "VALUES (%(r)s, %(c)s, %(f)s, %(p)s) RETURNING id",
        {"r": route.id, "c": center_date, "f": flex, "p": cfg.pax})
    lo, hi = center_date - timedelta(days=flex), center_date + timedelta(days=flex)
    win = [float(r["price"]) for r in latest_calendar(route.id, cfg.currency)
           if lo <= r["depart_date"] <= hi]
    win_txt = f"当前窗口最低 {s}{min(win):.0f}" if win else "窗口内暂无采价数据"
    return f"已登记盯价 {o}→{d} {center} ±{flex}（{lo}~{hi}），{win_txt}"


# ------------------------------------------------------------- /bought -----

def cmd_bought(m: re.Match) -> str:
    alert_id, paid = int(m.group(1)), float(m.group(2))
    row = query_one(
        "SELECT a.id, o.route_id, o.depart_date FROM alert a "
        "JOIN opportunity o ON o.id = a.opportunity_id WHERE a.id = %(a)s", {"a": alert_id})
    if not row:
        return f"未找到 alert {alert_id}"
    cfg = load_config()
    s = sym(cfg.currency)
    route_id = row["route_id"]
    dep = row["depart_date"]
    p50 = None
    if dep:
        bucket = lead_bucket(dep, today_sgt(), vars(cfg.baseline.lead_buckets))
        base = resolve_baseline_db(route_id, dep.strftime("%Y-%m"), bucket, cfg.baseline.min_sample)
        p50 = float(base.p50) if base and base.p50 is not None else None
    saving = (p50 - paid) if p50 is not None else None
    execute(
        "INSERT INTO purchase (alert_id, route_id, paid_price, baseline_p50_at_purchase, saving) "
        "VALUES (%(a)s, %(r)s, %(p)s, %(b)s, %(s)s)",
        {"a": alert_id, "r": route_id, "p": paid, "b": p50, "s": saving})
    annual = query_one(
        "SELECT COALESCE(SUM(saving),0) AS s FROM purchase WHERE purchased_at >= date_trunc('year', now())")
    ann = float(annual["s"]) if annual else 0.0
    if saving is None:
        return (f"已登记购票 {route_id} {s}{paid:.0f}（无基线 p50，本次节省未计）\n"
                f"年度累计节省 {s}{ann:.0f}")
    return (f"已登记购票 {route_id} {s}{paid:.0f}，本次节省 {s}{saving:.0f}\n"
            f"年度累计节省 {s}{ann:.0f}")


# ------------------------------------------------------------- /mute -------

def cmd_mute(m: re.Match) -> str:
    token, days = m.group(1), int(m.group(2))
    route = _resolve_route_token(token)
    if not route:
        return f"未找到航线 {token}"
    until = now_sgt() + timedelta(days=days)
    execute(
        "INSERT INTO route_mute (route_id, mute_until) VALUES (%(r)s, %(u)s) "
        "ON CONFLICT (route_id) DO UPDATE SET mute_until = EXCLUDED.mute_until",
        {"r": route.id, "u": until})
    return f"已静音 {route.id} {days} 天，至 {until:%Y-%m-%d %H:%M}"


# ------------------------------------------------------------- /status -----

def cmd_status(m: re.Match) -> str:
    cfg = load_config()
    s = sym(cfg.currency)
    last = query_one("SELECT max(captured_at) AS t FROM price_snapshot")
    last_txt = last["t"].strftime("%Y-%m-%d %H:%M") if last and last["t"] else "无"
    ops = query_one(
        "SELECT COALESCE(SUM(requests),0) AS req, COALESCE(SUM(ok),0) AS ok "
        "FROM ops_log WHERE day >= CURRENT_DATE - 30")
    rate = (ops["ok"] / ops["req"] * 100) if ops and ops["req"] else 0.0
    budgets = []
    for p, b in vars(cfg.providers.daily_budget).items():
        u = query_one("SELECT COALESCE(used,0) AS u FROM provider_usage WHERE provider=%(p)s AND day=CURRENT_DATE",
                      {"p": p})
        used = u["u"] if u else 0
        budgets.append(f"{p} {b - used}/{b}")
    serp = query_one("SELECT COALESCE(SUM(used),0) AS s FROM provider_usage "
                     "WHERE provider='serpapi' AND day >= date_trunc('month', CURRENT_DATE)")
    serp_used = serp["s"] if serp else 0
    lowconf = query_one("SELECT count(*) AS c FROM baseline WHERE low_confidence")
    annual = query_one("SELECT COALESCE(SUM(saving),0) AS s FROM purchase "
                       "WHERE purchased_at >= date_trunc('year', now())")
    return (
        "FareRadar 状态\n"
        f"最近采价：{last_txt}\n"
        f"30天成功率：{rate:.0f}%\n"
        f"今日预算余量：{' ｜ '.join(budgets)}\n"
        f"SerpAPI 当月：{serp_used}/{cfg.providers.serpapi_monthly_cap}\n"
        f"低置信度基线：{lowconf['c'] if lowconf else 0} 格\n"
        f"年度累计节省：{s}{float(annual['s']) if annual else 0:.0f}"
    )


# ------------------------------------------------------------- 分发 --------

_HANDLERS = [
    (r"^/fare\s+([A-Z]{3})\s+([A-Z]{3})(?:\s+(\d{4}-\d{2}))?$", cmd_fare),
    (r"^/watch\s+([A-Z]{3})\s+([A-Z]{3})\s+(\d{4}-\d{2}-\d{2})\s*(?:±|\+|-)?\s*(\d)$", cmd_watch),
    (r"^/bought\s+(\d+)\s+([\d.]+)$", cmd_bought),
    (r"^/mute\s+([A-Z0-9]+(?:-[A-Z]{3})?)\s+(\d+)$", cmd_mute),
    (r"^/status$", cmd_status),
]


def dispatch_command(text: str) -> str:
    text = text.strip()
    for pat, handler in _HANDLERS:
        m = re.match(pat, text)
        if m:
            return handler(m)
    return HELP
