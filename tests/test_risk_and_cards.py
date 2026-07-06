"""风险与卡片纯逻辑单测（§13.1）：LCC 标签与折算总价、DEFAULT_LCC 回退、
字段校验拒发、建议档映射（p10 边界、low_confidence 降档）。"""
from datetime import date

from app.notify.cards import suggest, validate_card_fields
from app.settings import load_baggage, load_config
from app.signals.engine import OpportunityDraft
from app.signals.risk import RiskResult, assess_risk

CFG = load_config()
BAGGAGE = load_baggage()


def _breach(alt_price, carrier=None, low_conf=False, p10=260.0, p15=300.0, pct=6):
    return OpportunityDraft(
        type="baseline_breach", route_id="R1", depart_date=date(2026, 8, 21),
        return_date=None, base_price=412.0, alt_price=alt_price, saving=412.0 - alt_price,
        evidence_snapshot_ids=[1],
        detail={"carrier": carrier, "stops": 0, "percentile_now": pct,
                "p10": p10, "p15": p15, "p50": 412.0, "window_low": 255.0,
                "low_confidence": low_conf, "trigger": "阈值 P15"})


# ---------------------------------------------- LCC 标签与折算总价 ----------

def test_lcc_tag_and_effective_total():
    risk = assess_risk(CFG, BAGGAGE, _breach(268.0, carrier="TR"))
    assert "lcc_baggage" in risk.tags
    assert risk.baggage_fee == 48.0                 # Scoot
    assert risk.effective_total == 268.0 + 48.0     # 316


def test_default_lcc_fallback():
    # VZ 在 lcc_carriers 但不在 fees_sgd → DEFAULT_LCC=50
    risk = assess_risk(CFG, BAGGAGE, _breach(200.0, carrier="VZ"))
    assert "lcc_baggage" in risk.tags
    assert risk.baggage_fee == 50.0
    assert risk.effective_total == 250.0


def test_full_service_no_folded():
    risk = assess_risk(CFG, BAGGAGE, _breach(268.0, carrier="SQ"))  # 全服务
    assert "lcc_baggage" not in risk.tags
    assert risk.effective_total is None


def test_low_confidence_tag():
    risk = assess_risk(CFG, BAGGAGE, _breach(268.0, carrier="TR", low_conf=True))
    assert "low_confidence_baseline" in risk.tags


# ---------------------------------------------- 字段校验拒发 ---------------

def test_validate_missing_baseline_position():
    draft = _breach(268.0, carrier=None, pct=None)
    draft.detail["low_confidence"] = False
    risk = assess_risk(CFG, BAGGAGE, draft)
    assert validate_card_fields(draft, risk) is False


def test_validate_lcc_missing_folded():
    draft = _breach(268.0, carrier="TR")
    bad_risk = RiskResult(tags=["lcc_baggage"], hard_block=False, block_reason=None,
                          effective_total=None, baggage_fee=None)
    assert validate_card_fields(draft, bad_risk) is False


def test_validate_pass():
    draft = _breach(268.0, carrier="TR")
    risk = assess_risk(CFG, BAGGAGE, draft)
    assert validate_card_fields(draft, risk) is True


# ---------------------------------------------- 建议档映射 -----------------

def test_suggest_below_p10_four_stars():
    draft = _breach(250.0, p10=260.0, p15=300.0)   # price < p10
    risk = assess_risk(CFG, BAGGAGE, draft)
    stars, action, color = suggest(draft, risk)
    assert (stars, action, color) == (4, "立即买", "green")


def test_suggest_between_p10_p15_three_stars():
    draft = _breach(280.0, p10=260.0, p15=300.0)   # p10 <= price < p15
    risk = assess_risk(CFG, BAGGAGE, draft)
    stars, action, color = suggest(draft, risk)
    assert (stars, action, color) == (3, "立即买", "green")


def test_suggest_low_confidence_downgrade():
    draft = _breach(250.0, p10=260.0, p15=300.0, low_conf=True)  # 本应 4★立即买
    risk = assess_risk(CFG, BAGGAGE, draft)
    stars, action, color = suggest(draft, risk)
    assert action == "关注"
    assert stars == 3        # 4 - 1
    assert color == "blue"
