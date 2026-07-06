"""飞书卡片构建 + 字段校验（§10.1）。

模板 A 信号卡 / B 运维卡 / C 周报卡；字段校验（FR-NTF-01）。
卡片色见附录 A：立即买 green ｜ 关注 blue ｜ 运维 red ｜ 周报 purple。
"""
import urllib.parse
from datetime import date, datetime

from app.settings import currency_symbol as sym

_WEEKDAY_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
_TYPE_TITLE = {
    "baseline_breach": "低价信号",
    "date_shift": "日期平移",
    "nearby_airport": "邻近机场",
    "self_transfer": "分开出票",
}
_RULE_NAME = {
    "baseline_breach": "BaselineBreach",
    "date_shift": "DateShiftRule",
    "nearby_airport": "NearbyAirportRule",
    "self_transfer": "SelfTransferRule",
}


def build_ops_card(text: str) -> dict:
    """模板 B · 运维卡：header red，正文一段 lark_md。"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "template": "red",
            "title": {"tag": "plain_text", "content": "⚠️ FareRadar 运维通知"},
        },
        "elements": [
            {"tag": "div", "text": {"tag": "lark_md", "content": text}},
            {"tag": "note", "elements": [{"tag": "plain_text", "content": ts}]},
        ],
    }


def build_weekly_card(levels_md: str, queued_md: str, health_md: str) -> dict:
    """模板 C · 周报卡：header purple；三段（航线水位 / 被限流机会 / 系统健康）。"""
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "template": "purple",
            "title": {"tag": "plain_text", "content": "📊 FareRadar 周报"},
        },
        "elements": [
            {"tag": "div", "text": {"tag": "lark_md", "content": "**各航线价格水位**\n" + levels_md}},
            {"tag": "hr"},
            {"tag": "div", "text": {"tag": "lark_md", "content": "**本周被限流的次级机会**\n" + queued_md}},
            {"tag": "hr"},
            {"tag": "div", "text": {"tag": "lark_md", "content": "**系统健康**\n" + health_md}},
        ],
    }


# --------------------------------------------------------------- 深链 -------

def deeplink(o: str, d: str, dep: date, ret: date | None = None) -> str:
    """搜索型深链（§10.2，非锁价链接）。"""
    q = f"Flights from {o} to {d} on {dep:%Y-%m-%d}"
    if ret:
        q += f" returning {ret:%Y-%m-%d}"
    return "https://www.google.com/travel/flights?q=" + urllib.parse.quote(q)


# --------------------------------------------------- 建议档 + 字段校验 -------

def suggest(draft, risk) -> tuple[int, str, str]:
    """建议档映射（§10.1）：返回 (stars, action, header_color)。"""
    price = float(draft.alt_price)
    d = draft.detail
    low_conf = "low_confidence_baseline" in risk.tags
    if draft.type == "baseline_breach":
        p10, p15 = d.get("p10"), d.get("p15")
        if p10 is not None and price < p10:
            stars, action = 4, "立即买"
        elif p15 is not None and price < p15:
            stars, action = 3, "立即买"
        else:
            stars, action = 3, "关注"
    else:
        stars, action = 3, "关注"
    if low_conf:
        stars = max(stars - 1, 1)
        action = "关注"
    color = "green" if action == "立即买" else "blue"
    return stars, action, color


def validate_card_fields(draft, risk) -> bool:
    """FR-NTF-01：缺基线位置（percentile_now 或 low_confidence 标注）或 LCC 缺折算总价 → 拒发。"""
    d = draft.detail
    has_baseline_pos = d.get("percentile_now") is not None or "low_confidence_baseline" in risk.tags
    if not has_baseline_pos:
        return False
    if "lcc_baggage" in risk.tags and risk.effective_total is None:
        return False
    return True


# ----------------------------------------------------------- 信号卡 A -------

def _carrier_line(currency: str, carrier, stops) -> str:
    if not carrier:
        return ""
    if stops == 0:
        conn = "直飞"
    elif stops is None:
        conn = ""
    else:
        conn = f"{stops}中转"
    return f"｜ {carrier} {conn}".rstrip()


def build_signal_card(cfg, draft, risk, origin: str, dest: str, alert_id: int) -> dict:
    """模板 A · 信号卡。调用前须 validate_card_fields 通过。"""
    d = draft.detail
    cur = cfg.currency
    s = sym(cur)
    stars, action, color = suggest(draft, risk)

    dep = draft.depart_date
    weekday = _WEEKDAY_CN[dep.weekday()] if dep else "-"
    return_line = f" → 返 {draft.return_date:%Y-%m-%d}" if draft.return_date else ""

    carrier_line = _carrier_line(cur, d.get("carrier"), d.get("stops"))
    effective_line = ""
    if risk.effective_total is not None:
        effective_line = f"｜ 托运折算 {s}{risk.effective_total:.0f}"

    pct = d.get("percentile_now")
    pct_str = f"P{pct}" if pct is not None else "—"
    p50 = d.get("p50")
    p50_str = f"{s}{float(p50):.0f}" if p50 is not None else "—"
    wlow = d.get("window_low")
    wlow_str = f"{s}{float(wlow):.0f}" if wlow is not None else "—"
    low_conf_mark = "（low_confidence）" if "low_confidence_baseline" in risk.tags else ""

    rule_name = _RULE_NAME.get(draft.type, draft.type)
    trigger_desc = d.get("trigger", "")
    risk_tags = " / ".join(risk.tags) if risk.tags else "无"
    stars_str = "★" * stars
    reason = f"当前 {pct_str}，窗口最低 {wlow_str}"

    title = f"{_TYPE_TITLE.get(draft.type, '信号')} · {origin} → {dest}"
    content = (
        f"**出发** {dep:%Y-%m-%d}（{weekday}）{return_line}\n"
        f"**价格** {s}{float(draft.alt_price):.0f} {carrier_line}{effective_line}\n"
        f"**基线** 当前 {pct_str} ｜ 中位 {p50_str} ｜ 窗口最低 {wlow_str}{low_conf_mark}\n"
        f"**触发** {rule_name}（{trigger_desc}）\n"
        f"**风险** {risk_tags}\n"
        f"**建议** {stars_str} {action}（{reason}）"
    )
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "template": color,
            "title": {"tag": "plain_text", "content": title},
        },
        "elements": [
            {"tag": "div", "text": {"tag": "lark_md", "content": content}},
            {"tag": "action", "actions": [
                {"tag": "button", "type": "primary",
                 "text": {"tag": "plain_text", "content": "打开 Google Flights"},
                 "url": deeplink(origin, dest, dep, draft.return_date)}]},
            {"tag": "note", "elements": [{"tag": "plain_text",
             "content": f"回复 /bought {alert_id} <成交价> 登记已购 · /mute {draft.route_id} 7 静音"}]},
        ],
    }
