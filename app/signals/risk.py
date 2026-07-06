"""风险过滤（§9.6）：硬约束、风险标签、折算总价（FR-RSK-02/03）。

标签枚举：two_ticket / border_crossing / lcc_baggage / overnight_layover /
short_layover(240–300min) / low_confidence_baseline。
折算总价：LCC 报价必须叠加托运行李费；无费率配置回退 DEFAULT_LCC。
"""
from dataclasses import dataclass

# 风险标签集中定义（RSK-02：标签集中定义，卡片渲染齐全）
TAG_TWO_TICKET = "two_ticket"
TAG_BORDER_CROSSING = "border_crossing"
TAG_LCC_BAGGAGE = "lcc_baggage"
TAG_OVERNIGHT = "overnight_layover"
TAG_SHORT_LAYOVER = "short_layover"
TAG_LOW_CONF = "low_confidence_baseline"


@dataclass(frozen=True)
class RiskResult:
    tags: list[str]
    hard_block: bool
    block_reason: str | None
    effective_total: float | None   # LCC 折算总价（含行李费）；非 LCC 为 None
    baggage_fee: float | None


def baggage_fee(baggage: dict, carrier: str | None) -> float | None:
    """LCC 承运人 → 托运行李费（SGD）；非 LCC 返回 None。"""
    if not carrier or carrier not in baggage["lcc_carriers"]:
        return None
    fees = baggage["fees_sgd"]
    return float(fees.get(carrier, fees["DEFAULT_LCC"]))


def assess_risk(cfg, baggage: dict, draft) -> RiskResult:
    tags: list[str] = []
    detail = draft.detail
    hard_block = False
    reason: str | None = None

    if detail.get("low_confidence"):
        tags.append(TAG_LOW_CONF)
    if draft.type == "self_transfer":
        tags.append(TAG_TWO_TICKET)
    if draft.type == "nearby_airport":
        tags.append(TAG_BORDER_CROSSING)
    if detail.get("overnight"):
        tags.append(TAG_OVERNIGHT)

    # short_layover: 衔接 240–300 分钟（self_transfer 组合携带 min_connect_min）
    cm = detail.get("min_connect_min")
    if cm is not None and 240 <= cm <= 300:
        tags.append(TAG_SHORT_LAYOVER)

    # 硬约束兜底复检（§9.6）：self_transfer 衔接不足（规则内已保证，此处防御）
    if draft.type == "self_transfer" and cm is not None and cm < cfg.rules.self_transfer.min_connect_min:
        hard_block = True
        reason = f"self_transfer 衔接 {cm}min < {cfg.rules.self_transfer.min_connect_min}min"

    # 折算总价（FR-RSK-03）
    carrier = detail.get("carrier")
    fee = baggage_fee(baggage, carrier)
    effective = None
    if fee is not None:
        tags.append(TAG_LCC_BAGGAGE)
        effective = float(draft.alt_price) + fee

    return RiskResult(tags=tags, hard_block=hard_block, block_reason=reason,
                      effective_total=effective, baggage_fee=fee)
