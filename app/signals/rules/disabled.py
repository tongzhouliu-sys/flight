"""禁用规则插槽（FR-SIG-06）：HiddenCity / CurrencyArbitrage / OpenJaw。

统一 Rule 接口，enabled=False，evaluate 恒返回空列表。默认关闭，接口与开关保留。
不实现 PRD §4.2 排除项（弃程等）。
"""
from app.signals.engine import OpportunityDraft, RuleContext


class _DisabledRule:
    enabled = False

    def __init__(self, name: str):
        self.name = name

    def evaluate(self, ctx: RuleContext) -> list[OpportunityDraft]:
        return []


class HiddenCityRule(_DisabledRule):
    def __init__(self):
        super().__init__("hidden_city")


class CurrencyArbitrageRule(_DisabledRule):
    def __init__(self):
        super().__init__("currency_arbitrage")


class OpenJawRule(_DisabledRule):
    def __init__(self):
        super().__init__("open_jaw")


DISABLED_RULES = [HiddenCityRule(), CurrencyArbitrageRule(), OpenJawRule()]
