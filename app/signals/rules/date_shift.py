"""DateShift（P1，§9.3）。

对每个 active TripIntent：窗口 [center-flex, center+flex]（含端点）；
中心日无快照 → 记日志跳过；saving = price(center) - min(window)；
触发 saving >= max(min_pct*price(center), min_abs)；detail 含 best_date。
Intent 的 date_center + flex < today → 置 expired。
"""
import logging
from datetime import timedelta

from app.baseline.engine import grid_stats, lead_bucket
from app.db import execute
from app.signals.engine import OpportunityDraft, RuleContext, drill_evidence

log = logging.getLogger("fareradar.date_shift")


def date_shift_triggered(center_price: float, best_price: float,
                         min_pct: float, min_abs: float) -> bool:
    """纯判定：节省 >= max(min_pct*center, min_abs) 且 > 0。"""
    saving = center_price - best_price
    return saving > 0 and saving >= max(min_pct * center_price, min_abs)


class DateShiftRule:
    name = "date_shift"
    enabled = True

    def evaluate(self, ctx: RuleContext) -> list[OpportunityDraft]:
        rc = ctx.cfg.rules.date_shift
        drafts: list[OpportunityDraft] = []
        for intent in ctx.active_intents():
            route = ctx.route(intent["route_id"])
            if route is None:
                continue
            center = intent["date_center"]
            flex = int(intent["flex_days"])

            if center + timedelta(days=flex) < ctx.today():
                execute("UPDATE trip_intent SET status = 'expired' WHERE id = %(id)s",
                        {"id": intent["id"]})
                continue

            cal = {r["depart_date"]: r for r in ctx.latest_calendar(route.id)}
            center_row = cal.get(center)
            if not center_row:
                log.info("date_shift 跳过 intent=%s：中心日 %s 无快照", intent["id"], center)
                continue

            lo, hi = center - timedelta(days=flex), center + timedelta(days=flex)
            window = [(d, r) for d, r in cal.items() if lo <= d <= hi]
            if not window:
                continue
            best_d, best_r = min(window, key=lambda x: float(x[1]["price"]))
            center_price = float(center_row["price"])
            best_price = float(best_r["price"])

            if not date_shift_triggered(center_price, best_price, rc.min_pct, rc.min_abs):
                continue

            month = best_d.strftime("%Y-%m")
            bucket = lead_bucket(best_d, ctx.today(), ctx.lead_buckets)
            base = ctx.resolve_baseline(route.id, month, bucket)
            stats = grid_stats(ctx.cfg, route.id, month, bucket, best_price)
            det_ids, carrier, stops = drill_evidence(route.id, best_d, ctx.currency)

            drafts.append(OpportunityDraft(
                type="date_shift", route_id=route.id,
                depart_date=best_d, return_date=best_r["return_date"],
                base_price=center_price, alt_price=best_price,
                saving=center_price - best_price,
                evidence_snapshot_ids=[center_row["id"], best_r["id"]] + det_ids,
                detail={
                    "best_date": best_d.isoformat(),
                    "center_date": center.isoformat(),
                    "percentile_now": stats["pct"],
                    "window_low": stats["wlow"],
                    "low_confidence": base.low_confidence if base else True,
                    "p50": base.p50 if base else None,
                    "carrier": carrier, "stops": stops,
                    "trigger": f"±{flex}天 最优 {best_d.isoformat()}",
                },
            ))
        return drafts
