"""告警管理（§9.7）：落库 opportunity/risk_card、去重、周上限、静音、推送。

dedup_key = route:depart:return:type:价格档（S$10 取整）；TTL 72h；
周上限超出 → queued_weekly（周日 weekly_report 汇总，UAT-08）。
mute > dedup > 周上限 > sent 的优先级。
"""
import logging
from datetime import timedelta, timezone

from app.db import execute_returning, get_route, jsonb, query_one
from app.notify.cards import build_signal_card, validate_card_fields
from app.notify.feishu import push_card
from app.settings import load_baggage, now_sgt
from app.signals.risk import assess_risk

log = logging.getLogger("fareradar.alerts")


# ------------------------------------------------------ 纯函数（单测）------

def dedup_key(draft, bucket_sgd: int) -> str:
    rd = draft.return_date.isoformat() if draft.return_date else "-"
    price_bucket = int(float(draft.alt_price) // bucket_sgd) * bucket_sgd
    return f"{draft.route_id}:{draft.depart_date}:{rd}:{draft.type}:{price_bucket}"


def classify(is_muted: bool, is_dedup: bool, sent_count: int, weekly_cap: int) -> str:
    """状态判定优先级：mute > dedup > 周上限 > sent。"""
    if is_muted:
        return "suppressed_mute"
    if is_dedup:
        return "suppressed_dedup"
    if sent_count >= weekly_cap:
        return "queued_weekly"
    return "sent"


# ------------------------------------------------------------- DB 交互 -----

def _insert_opportunity(d) -> int:
    r = execute_returning(
        "INSERT INTO opportunity (type, route_id, depart_date, return_date, base_price, "
        "alt_price, saving, detail, evidence_snapshot_ids) "
        "VALUES (%(type)s, %(rid)s, %(dep)s, %(ret)s, %(base)s, %(alt)s, %(sav)s, %(detail)s, %(evi)s) "
        "RETURNING id",
        {"type": d.type, "rid": d.route_id, "dep": d.depart_date, "ret": d.return_date,
         "base": d.base_price, "alt": d.alt_price, "sav": d.saving,
         "detail": jsonb(d.detail), "evi": list(d.evidence_snapshot_ids)})
    return r["id"]


def _insert_risk_card(opp_id: int, risk) -> None:
    execute_returning(
        "INSERT INTO risk_card (opportunity_id, tags, hard_block, block_reason) "
        "VALUES (%(o)s, %(t)s, %(h)s, %(r)s) RETURNING opportunity_id",
        {"o": opp_id, "t": jsonb(risk.tags), "h": risk.hard_block, "r": risk.block_reason})


def _insert_alert(opp_id: int, key: str, status: str) -> int:
    r = execute_returning(
        "INSERT INTO alert (opportunity_id, dedup_key, channel, status) "
        "VALUES (%(o)s, %(k)s, 'feishu', %(s)s) RETURNING id",
        {"o": opp_id, "k": key, "s": status})
    return r["id"]


def _week_start_utc():
    now = now_sgt()
    monday = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    return monday.astimezone(timezone.utc)


def _week_sent_count(week_start) -> int:
    r = query_one("SELECT count(*) AS c FROM alert WHERE status = 'sent' AND sent_at >= %(ws)s",
                  {"ws": week_start})
    return int(r["c"]) if r else 0


def _dedup_hit(key: str, ttl_hours: int) -> bool:
    r = query_one(
        "SELECT 1 FROM alert WHERE dedup_key = %(k)s "
        "AND sent_at > now() - make_interval(hours => %(ttl)s) AND status = 'sent' LIMIT 1",
        {"k": key, "ttl": ttl_hours})
    return r is not None


def _route_muted(route_id: str) -> bool:
    r = query_one("SELECT 1 FROM route_mute WHERE route_id = %(r)s AND mute_until > now() LIMIT 1",
                  {"r": route_id})
    return r is not None


# ------------------------------------------------------------- 主流程 ------

def dispatch_alerts(cfg, drafts) -> dict:
    baggage = load_baggage()
    candidates = []
    for d in drafts:
        risk = assess_risk(cfg, baggage, d)
        opp_id = _insert_opportunity(d)
        _insert_risk_card(opp_id, risk)
        if not risk.hard_block:
            candidates.append((d, risk, opp_id))

    candidates.sort(key=lambda x: float(x[0].saving), reverse=True)   # 按 saving 降序
    week_start = _week_start_utc()
    sent = _week_sent_count(week_start)
    cap = cfg.alerts.weekly_cap
    ttl = cfg.alerts.dedup_ttl_hours
    bucket = cfg.alerts.price_bucket_sgd

    tally = {"sent": 0, "queued_weekly": 0, "suppressed_dedup": 0,
             "suppressed_mute": 0, "rejected": 0}
    for d, risk, opp_id in candidates:
        key = dedup_key(d, bucket)
        status = classify(_route_muted(d.route_id), _dedup_hit(key, ttl), sent, cap)
        if status == "sent":
            if not validate_card_fields(d, risk):
                log.warning("卡片字段校验失败，拒发 opp=%s", opp_id)
                tally["rejected"] += 1
                continue
            alert_id = _insert_alert(opp_id, key, "sent")
            route = get_route(d.route_id)
            push_card(build_signal_card(cfg, d, risk, route.origin, route.dest, alert_id))
            sent += 1
            tally["sent"] += 1
        else:
            _insert_alert(opp_id, key, status)
            tally[status] += 1
    log.info("dispatch: %s", tally)
    return tally
