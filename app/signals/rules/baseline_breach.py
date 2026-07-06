"""BaselineBreach（P0，§9.2）。

对每条航线最新日历视图逐日：resolve_baseline → 无基线跳过；
price < p15（TEST_FORCE_BREACH=1 时改用 p95 语义 price < p50*10）→ 产出 draft。
base_price = p50，alt_price = price，saving = p50 - price；
evidence = 日历快照 id + 该日期钻取详情快照 id（若有）；
detail 含 percentile_now、low_confidence、p10/p15/p50、carrier/stops、window_low。
证据链（FR-SIG-05）：至少 1 个真实 snapshot_id，无证据不产出。
"""
from datetime import date

from app.baseline.engine import grid_stats, lead_bucket
from app.db import query
from app.signals.engine import OpportunityDraft, RuleContext

DRILL_EVIDENCE_SQL = """
SELECT id, carrier, stops, price
FROM price_snapshot
WHERE route_id = %(rid)s AND NOT is_calendar AND depart_date = %(d)s
  AND currency = %(cur)s AND captured_at > now() - interval '36 hours'
ORDER BY price ASC
"""


def _drill_evidence(route_id: str, d: date, currency: str):
    rows = query(DRILL_EVIDENCE_SQL, {"rid": route_id, "d": d, "cur": currency})
    ids = [r["id"] for r in rows]
    carrier = rows[0]["carrier"] if rows else None
    stops = rows[0]["stops"] if rows else None
    return ids, carrier, stops


class BaselineBreachRule:
    name = "baseline_breach"
    enabled = True

    def evaluate(self, ctx: RuleContext) -> list[OpportunityDraft]:
        drafts: list[OpportunityDraft] = []
        for route in ctx.routes:
            for row in ctx.latest_calendar(route.id):
                d = row["depart_date"]
                price = float(row["price"])
                month = d.strftime("%Y-%m")
                bucket = lead_bucket(d, ctx.today(), ctx.lead_buckets)
                base = ctx.resolve_baseline(route.id, month, bucket)
                if base is None or base.p15 is None or base.p50 is None:
                    continue
                if ctx.force_breach:
                    threshold = base.p50 * 10          # p95 语义（恒真），仅测试
                    trigger = "TEST 强制"
                else:
                    threshold = base.p15
                    trigger = "阈值 P15"
                if price >= threshold:
                    continue

                stats = grid_stats(ctx.cfg, route.id, month, bucket, price)
                det_ids, carrier, stops = _drill_evidence(route.id, d, ctx.currency)
                evidence = [row["id"]] + det_ids
                if not evidence:                       # 证据链保底（FR-SIG-05）
                    continue

                drafts.append(OpportunityDraft(
                    type="baseline_breach", route_id=route.id,
                    depart_date=d, return_date=row["return_date"],
                    base_price=base.p50, alt_price=price, saving=base.p50 - price,
                    evidence_snapshot_ids=evidence,
                    detail={
                        "percentile_now": stats["pct"],
                        "window_low": stats["wlow"],
                        "low_confidence": base.low_confidence,
                        "p10": base.p10, "p15": base.p15, "p50": base.p50,
                        "carrier": carrier, "stops": stops,
                        "trigger": trigger,
                    },
                ))
        return drafts
