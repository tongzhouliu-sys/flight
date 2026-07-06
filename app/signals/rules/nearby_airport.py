"""NearbyAirport（P1，§9.4）。

对配置了 nearby 的航线逐日比较原始视图与影子视图：
effective = shadow_price + adder_sgd；saving = base_price - effective；
触发 saving >= max(min_pct*base_price, min_abs)；detail 含 variant、adder_sgd；
风险标签追加 border_crossing（由 risk 按 type 生成）。
"""
from app.baseline.engine import grid_stats, lead_bucket
from app.signals.engine import OpportunityDraft, RuleContext, drill_evidence


def nearby_triggered(base_price: float, shadow_price: float, adder: float,
                     min_pct: float, min_abs: float) -> bool:
    """纯判定：折算加价后节省 >= max(min_pct*base, min_abs) 且 > 0。"""
    saving = base_price - (shadow_price + adder)
    return saving > 0 and saving >= max(min_pct * base_price, min_abs)


class NearbyAirportRule:
    name = "nearby_airport"
    enabled = True

    def evaluate(self, ctx: RuleContext) -> list[OpportunityDraft]:
        rc = ctx.cfg.rules.nearby
        adder = rc.adder_sgd
        drafts: list[OpportunityDraft] = []
        for route in ctx.routes:
            if not route.nearby_airports:
                continue
            orig = {r["depart_date"]: r for r in ctx.latest_calendar(route.id, None)}
            for variant in route.nearby_airports:
                shadow = {r["depart_date"]: r for r in ctx.latest_calendar(route.id, variant)}
                for d, orow in orig.items():
                    srow = shadow.get(d)
                    if not srow:
                        continue
                    base_price = float(orow["price"])
                    shadow_price = float(srow["price"])
                    if not nearby_triggered(base_price, shadow_price, adder, rc.min_pct, rc.min_abs):
                        continue
                    effective = shadow_price + adder
                    month = d.strftime("%Y-%m")
                    bucket = lead_bucket(d, ctx.today(), ctx.lead_buckets)
                    base = ctx.resolve_baseline(route.id, month, bucket)
                    stats = grid_stats(ctx.cfg, route.id, month, bucket, base_price)
                    det_ids, carrier, stops = drill_evidence(route.id, d, ctx.currency)

                    drafts.append(OpportunityDraft(
                        type="nearby_airport", route_id=route.id,
                        depart_date=d, return_date=orow["return_date"],
                        base_price=base_price, alt_price=effective,
                        saving=base_price - effective,
                        evidence_snapshot_ids=[orow["id"], srow["id"]] + det_ids,
                        detail={
                            "variant": variant,
                            "adder_sgd": adder,
                            "shadow_price": shadow_price,
                            "percentile_now": stats["pct"],
                            "window_low": stats["wlow"],
                            "low_confidence": base.low_confidence if base else True,
                            "p50": base.p50 if base else None,
                            "carrier": carrier, "stops": stops,
                            "trigger": f"经 {variant} 折算 +{adder}",
                        },
                    ))
        return drafts
