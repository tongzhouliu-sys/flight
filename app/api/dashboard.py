"""只读 web 面板（GET /）：系统健康 + 各航线价格水位 + 最近信号。

服务端直接渲染 HTML（无前端框架、无外部依赖），数据全部来自现有库表。
只读、无敏感数据（NFR-04），公开可访问。
"""
import html

from app.baseline.engine import lead_bucket, resolve_baseline_db
from app.db import (latest_calendar, load_enabled_routes, query, query_one)
from app.settings import currency_symbol, load_config, now_sgt, today_sgt


def _esc(v) -> str:
    return html.escape(str(v))


def gather_health(cfg) -> dict:
    last = query_one("SELECT max(captured_at) AS t FROM price_snapshot")
    ops = query_one("SELECT COALESCE(SUM(requests),0) AS req, COALESCE(SUM(ok),0) AS ok "
                    "FROM ops_log WHERE day >= CURRENT_DATE - 30")
    rate = (ops["ok"] / ops["req"] * 100) if ops and ops["req"] else None
    budgets = []
    for p, b in vars(cfg.providers.daily_budget).items():
        u = query_one("SELECT COALESCE(used,0) AS u FROM provider_usage "
                      "WHERE provider=%(p)s AND day=CURRENT_DATE", {"p": p})
        budgets.append({"provider": p, "remaining": b - (u["u"] if u else 0), "total": b})
    serp = query_one("SELECT COALESCE(SUM(used),0) AS s FROM provider_usage "
                     "WHERE provider='serpapi' AND day >= date_trunc('month', CURRENT_DATE)")
    lowconf = query_one("SELECT count(*) AS c FROM baseline WHERE low_confidence")
    annual = query_one("SELECT COALESCE(SUM(saving),0) AS s FROM purchase "
                       "WHERE purchased_at >= date_trunc('year', now())")
    return {
        "last_scan": last["t"].strftime("%Y-%m-%d %H:%M") if last and last["t"] else "无",
        "success_rate": f"{rate:.0f}%" if rate is not None else "—",
        "budgets": budgets,
        "serp_used": serp["s"] if serp else 0,
        "serp_cap": cfg.providers.serpapi_monthly_cap,
        "low_conf": lowconf["c"] if lowconf else 0,
        "annual_saving": float(annual["s"]) if annual else 0.0,
    }


def _position(minp, base):
    if base is None or base.p25 is None:
        return ("无基线", "muted")
    if minp < float(base.p25):
        return ("低于 P25 · 便宜", "good")
    if base.p50 is not None and minp <= float(base.p50):
        return ("P25~P50 · 中等", "warn")
    return (">P50 · 偏贵", "bad")


def gather_levels(cfg) -> list[dict]:
    out = []
    for route in load_enabled_routes():
        rows = latest_calendar(route.id, cfg.currency)
        if not rows:
            out.append({"id": route.id, "pair": f"{route.origin}→{route.dest}",
                        "trip": route.trip_type, "min": None, "n": 0,
                        "pos": "无数据", "pos_cls": "muted", "best_date": "—"})
            continue
        best = min(rows, key=lambda r: float(r["price"]))
        minp = float(best["price"])
        d0 = best["depart_date"]
        bucket = lead_bucket(d0, today_sgt(), vars(cfg.baseline.lead_buckets))
        base = resolve_baseline_db(route.id, d0.strftime("%Y-%m"), bucket, cfg.baseline.min_sample)
        pos, cls = _position(minp, base)
        out.append({"id": route.id, "pair": f"{route.origin}→{route.dest}",
                    "trip": route.trip_type, "min": minp, "n": len(rows),
                    "pos": pos, "pos_cls": cls, "best_date": d0.isoformat()})
    return out


def gather_recent_alerts(limit: int = 25) -> list[dict]:
    rows = query(
        "SELECT a.id, a.status, a.sent_at, o.type, o.route_id, o.depart_date, "
        "       o.alt_price, o.saving "
        "FROM alert a JOIN opportunity o ON o.id = a.opportunity_id "
        "ORDER BY a.sent_at DESC LIMIT %(l)s", {"l": limit})
    return rows


_STATUS_BADGE = {
    "sent": ("已推送", "good"),
    "queued_weekly": ("进周报", "warn"),
    "suppressed_dedup": ("去重", "muted"),
    "suppressed_mute": ("静音", "muted"),
}
_TYPE_CN = {
    "baseline_breach": "基线击穿", "date_shift": "日期平移",
    "nearby_airport": "邻近机场", "self_transfer": "分开出票",
}

_CSS = """
:root{color-scheme:light dark;--bg:#0f1115;--card:#1a1d24;--fg:#e8eaed;--muted:#9aa0a6;
--line:#2a2e37;--good:#34a853;--warn:#f9ab00;--bad:#ea4335;--accent:#8ab4f8}
@media (prefers-color-scheme:light){:root{--bg:#f6f7f9;--card:#fff;--fg:#1f2328;
--muted:#6b7280;--line:#e5e7eb;--accent:#1a73e8}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);
font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
.wrap{max-width:1000px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:20px;margin:0 0 2px}.sub{color:var(--muted);font-size:13px;margin-bottom:20px}
h2{font-size:15px;margin:26px 0 10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
.tile .k{color:var(--muted);font-size:12px}.tile .v{font-size:22px;font-weight:650;margin-top:4px}
.scroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:520px}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
tr:last-child td{border-bottom:0}
.badge{display:inline-block;padding:1px 9px;border-radius:20px;font-size:12px;font-weight:600}
.good{color:var(--good)}.warn{color:var(--warn)}.bad{color:var(--bad)}.muted{color:var(--muted)}
.badge.good{background:color-mix(in srgb,var(--good) 18%,transparent)}
.badge.warn{background:color-mix(in srgb,var(--warn) 18%,transparent)}
.badge.bad{background:color-mix(in srgb,var(--bad) 18%,transparent)}
.badge.muted{background:color-mix(in srgb,var(--muted) 16%,transparent)}
.num{font-variant-numeric:tabular-nums;font-weight:600}
.foot{color:var(--muted);font-size:12px;margin-top:24px}
"""


def render_dashboard() -> str:
    cfg = load_config()
    s = currency_symbol(cfg.currency)
    health = gather_health(cfg)
    levels = gather_levels(cfg)
    alerts = gather_recent_alerts()

    budget_str = " ｜ ".join(f"{b['provider']} {b['remaining']}/{b['total']}" for b in health["budgets"])

    tiles = "".join([
        f'<div class="tile"><div class="k">最近采价</div><div class="v">{_esc(health["last_scan"])}</div></div>',
        f'<div class="tile"><div class="k">30天成功率</div><div class="v">{_esc(health["success_rate"])}</div></div>',
        f'<div class="tile"><div class="k">年度累计节省</div><div class="v">{s}{health["annual_saving"]:.0f}</div></div>',
        f'<div class="tile"><div class="k">低置信度基线</div><div class="v">{health["low_conf"]} <span style="font-size:13px;color:var(--muted)">格</span></div></div>',
        f'<div class="tile"><div class="k">SerpAPI 当月</div><div class="v">{health["serp_used"]}<span style="font-size:13px;color:var(--muted)">/{health["serp_cap"]}</span></div></div>',
        f'<div class="tile"><div class="k">今日预算余量</div><div class="v" style="font-size:14px;font-weight:600;padding-top:6px">{_esc(budget_str)}</div></div>',
    ])

    level_rows = ""
    for r in levels:
        minv = f'<span class="num">{s}{r["min"]:.0f}</span>' if r["min"] is not None else "—"
        level_rows += (
            f'<tr><td><b>{_esc(r["id"])}</b> {_esc(r["pair"])}</td>'
            f'<td>{_esc(r["trip"])}</td>'
            f'<td>{minv}</td>'
            f'<td>{_esc(r["best_date"])}</td>'
            f'<td><span class="{r["pos_cls"]}">{_esc(r["pos"])}</span></td>'
            f'<td class="muted">{r["n"]}</td></tr>')

    alert_rows = ""
    for a in alerts:
        label, cls = _STATUS_BADGE.get(a["status"], (a["status"], "muted"))
        typ = _TYPE_CN.get(a["type"], a["type"])
        when = a["sent_at"].strftime("%m-%d %H:%M") if a["sent_at"] else "—"
        alert_rows += (
            f'<tr><td class="muted">{when}</td>'
            f'<td><b>{_esc(a["route_id"])}</b></td>'
            f'<td>{_esc(typ)}</td>'
            f'<td>{_esc(a["depart_date"])}</td>'
            f'<td class="num">{s}{float(a["alt_price"]):.0f}</td>'
            f'<td class="num good">省{s}{float(a["saving"]):.0f}</td>'
            f'<td><span class="badge {cls}">{_esc(label)}</span></td></tr>')
    if not alert_rows:
        alert_rows = '<tr><td colspan="7" class="muted">暂无信号</td></tr>'

    now = now_sgt().strftime("%Y-%m-%d %H:%M:%S")
    return f"""<!doctype html><html lang="zh"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>FareRadar 面板</title>
<style>{_CSS}</style></head><body><div class="wrap">
<h1>✈️ FareRadar 面板</h1>
<div class="sub">只读视图 · 每 60 秒自动刷新 · 更新于 {now} SGT</div>

<h2>系统健康</h2>
<div class="tiles">{tiles}</div>

<h2>各航线价格水位（未来 60 天）</h2>
<div class="scroll"><table>
<thead><tr><th>航线</th><th>类型</th><th>60天最低</th><th>最低日</th><th>位置</th><th>采样</th></tr></thead>
<tbody>{level_rows}</tbody></table></div>

<h2>最近信号</h2>
<div class="scroll"><table>
<thead><tr><th>时间</th><th>航线</th><th>类型</th><th>出发</th><th>价格</th><th>节省</th><th>状态</th></tr></thead>
<tbody>{alert_rows}</tbody></table></div>

<div class="foot">FareRadar · 数据源 fli→fast-flights→SerpAPI · 交互在飞书，本页仅供浏览</div>
</div></body></html>"""
