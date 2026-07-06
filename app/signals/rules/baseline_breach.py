"""BaselineBreach（P0，§9.2）。

对每条航线最新日历视图逐日：resolve_baseline → 无基线跳过；
price < p15（TEST_FORCE_BREACH=1 时改用 p95 语义 price < p50*10）→ 产出 draft。
base_price = p50，alt_price = price，saving = p50 - price；
evidence = 日历快照 id + 该日期钻取详情快照 id（若有）；
detail 含 percentile_now、low_confidence、p10/p15/p50、carrier/stops、window_low。
证据链（FR-SIG-05）：至少 1 个真实 snapshot_id，无证据不产出。
"""
from app.baseline.engine import grid_stats, lead_bucket
from app.signals.engine import OpportunityDraft, RuleContext, drill_evidence


def is_breach(price: float, p15, p50, force: bool) -> bool:
    """纯判定：无基线（p15/p50 缺）→ False；force 用 p95 语义(price < p50*10)。"""
    if p15 is None or p50 is None:
        return False
    threshold = p50 * 10 if force else p15
    return price < threshold


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
                if base is None:
                    continue
                if not is_breach(price, base.p15, base.p50, ctx.force_breach):
                    continue

                stats = grid_stats(ctx.cfg, route.id, month, bucket, price)
                det_ids, carrier, stops = drill_evidence(route.id, d, ctx.currency)
                evidence = [row["id"]] + det_ids
                if not evidence:                       # 证据链保底（FR-SIG-05）
                    continue

                trigger = "TEST 强制" if ctx.force_breach else "阈值 P15"
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
