"""告警纯逻辑单测（§13.1）：dedup_key 价格取整、周上限分流、mute 优先。"""
from datetime import date

from app.signals.alerts import classify, dedup_key
from app.signals.engine import OpportunityDraft


def _draft(alt_price, route_id="R1", dep=date(2026, 8, 21), ret=None, typ="baseline_breach"):
    return OpportunityDraft(
        type=typ, route_id=route_id, depart_date=dep, return_date=ret,
        base_price=412.0, alt_price=alt_price, saving=412.0 - alt_price,
        evidence_snapshot_ids=[1], detail={})


# ------------------------------------------------------ dedup_key 价格取整 --

def test_dedup_key_price_rounding():
    assert dedup_key(_draft(267.0), 10) == "R1:2026-08-21:-:baseline_breach:260"
    assert dedup_key(_draft(260.0), 10) == "R1:2026-08-21:-:baseline_breach:260"
    assert dedup_key(_draft(269.99), 10) == "R1:2026-08-21:-:baseline_breach:260"


def test_dedup_key_includes_return_date():
    assert dedup_key(_draft(268.0, ret=date(2026, 8, 31)), 10) == \
        "R1:2026-08-21:2026-08-31:baseline_breach:260"


# --------------------------------------------------- 周上限第 5/6 条分流 ----

def test_weekly_cap_fifth_sent_sixth_queued():
    cap = 5
    # 已发 4 条 → 第 5 条 sent
    assert classify(False, False, sent_count=4, weekly_cap=cap) == "sent"
    # 已发 5 条 → 第 6 条 queued_weekly
    assert classify(False, False, sent_count=5, weekly_cap=cap) == "queued_weekly"


# --------------------------------------------------- mute 优先于 dedup -----

def test_mute_takes_priority_over_dedup():
    assert classify(is_muted=True, is_dedup=True, sent_count=0, weekly_cap=5) == "suppressed_mute"


def test_dedup_over_cap():
    assert classify(is_muted=False, is_dedup=True, sent_count=99, weekly_cap=5) == "suppressed_dedup"
