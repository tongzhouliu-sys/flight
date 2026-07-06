"""规则接口 + 注册表 + 执行器（§9.1）。

RuleContext 提供 config、latest_calendar、resolve_baseline、active_intents、today、force_breach。
OpportunityDraft = opportunity 表行的未落库形态（含 evidence_snapshot_ids）。
注册表容忍缺失模块（任务序列增量接入 date_shift/nearby/self_transfer）。
"""
import importlib
import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

from app.baseline.engine import resolve_baseline_db
from app.db import get_route, latest_calendar, load_enabled_routes, query
from app.settings import today_sgt

log = logging.getLogger("fareradar.signals")


@dataclass
class OpportunityDraft:
    type: str
    route_id: str
    depart_date: date | None
    return_date: date | None
    base_price: float
    alt_price: float
    saving: float
    evidence_snapshot_ids: list[int]
    detail: dict = field(default_factory=dict)


class Rule(Protocol):
    name: str
    enabled: bool
    def evaluate(self, ctx: "RuleContext") -> list[OpportunityDraft]: ...


class RuleContext:
    def __init__(self, cfg):
        self.cfg = cfg
        self.currency = cfg.currency
        self.min_sample = cfg.baseline.min_sample
        self.lead_buckets = vars(cfg.baseline.lead_buckets)
        self.routes = load_enabled_routes()
        self.force_breach = _force_breach()

    def latest_calendar(self, route_id: str, variant: str | None = None) -> list[dict]:
        return latest_calendar(route_id, self.currency, variant)

    def resolve_baseline(self, route_id: str, travel_month: str, bucket: str):
        return resolve_baseline_db(route_id, travel_month, bucket, self.min_sample)

    def active_intents(self) -> list[dict]:
        return query("SELECT * FROM trip_intent WHERE status = 'active'")

    def route(self, route_id: str):
        return get_route(route_id)

    def today(self) -> date:
        return today_sgt()


def _force_breach() -> bool:
    from app.settings import settings
    return settings.TEST_FORCE_BREACH


_DRILL_EVIDENCE_SQL = """
SELECT id, carrier, stops, price
FROM price_snapshot
WHERE route_id = %(rid)s AND NOT is_calendar AND depart_date = %(d)s
  AND currency = %(cur)s AND captured_at > now() - interval '36 hours'
ORDER BY price ASC
"""


def drill_evidence(route_id: str, d, currency: str):
    """某 (route, 出发日) 的钻取详情快照：返回 (ids, cheapest_carrier, cheapest_stops)。"""
    rows = query(_DRILL_EVIDENCE_SQL, {"rid": route_id, "d": d, "cur": currency})
    ids = [r["id"] for r in rows]
    carrier = rows[0]["carrier"] if rows else None
    stops = rows[0]["stops"] if rows else None
    return ids, carrier, stops


# ------------------------------------------------------------- 注册表 -------

_RULE_MODULES = [
    ("app.signals.rules.baseline_breach", "BaselineBreachRule"),
    ("app.signals.rules.date_shift", "DateShiftRule"),
    ("app.signals.rules.nearby_airport", "NearbyAirportRule"),
    ("app.signals.rules.self_transfer", "SelfTransferRule"),
]


def build_registry() -> dict[str, Rule]:
    reg: dict[str, Rule] = {}
    for modpath, clsname in _RULE_MODULES:
        try:
            mod = importlib.import_module(modpath)
        except ModuleNotFoundError:
            continue                       # 该规则尚未接入（任务序列）
        rule = getattr(mod, clsname)()
        reg[rule.name] = rule
    try:
        from app.signals.rules.disabled import DISABLED_RULES
        for r in DISABLED_RULES:
            reg[r.name] = r
    except ModuleNotFoundError:
        pass
    return reg


def run_rules(cfg, names: list[str]) -> list[OpportunityDraft]:
    ctx = RuleContext(cfg)
    registry = build_registry()
    drafts: list[OpportunityDraft] = []
    for name in names:
        rule = registry.get(name)
        if rule is None:
            log.info("规则 %s 未注册，跳过", name)
            continue
        if not getattr(rule, "enabled", False):
            continue
        drafts.extend(rule.evaluate(ctx))
    return drafts
