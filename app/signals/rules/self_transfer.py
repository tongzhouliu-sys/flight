"""SelfTransfer（P1，§9.5，weekly_selftransfer.py 周一执行）。

仅 round_trip 航线；经 hubs 白名单两票拼接，衔接 >= min_connect_min，
折算节省（扣除 insurance_sgd）>= max(min_pct*through, min_abs) → 产出。
每航线每周取最便宜的 candidate_dates 个日期；总详情查询 > max_queries 即停止整个任务。
缺任一段时刻数据（provider 未返回时间）→ 该组合按不可行处理（保守）。标签必含 two_ticket。
"""
import logging
from datetime import timedelta

from app.baseline.engine import grid_stats, lead_bucket
from app.providers.chain import AllProvidersFailed
from app.signals.engine import OpportunityDraft, RuleContext

log = logging.getLogger("fareradar.self_transfer")


# ------------------------------------------------------ 纯函数（单测）------

def connection_minutes(arrive, depart):
    if arrive is None or depart is None:
        return None
    return (depart - arrive).total_seconds() / 60.0


def is_feasible(arrive, depart, min_connect_min: int) -> bool:
    """衔接可行：到达/起飞时刻齐全且间隔 >= min_connect_min。缺时刻→不可行（保守）。"""
    m = connection_minutes(arrive, depart)
    return m is not None and m >= min_connect_min


def best_leg_pair(first_opts, second_opts, min_connect_min: int):
    """两段最低可行价组合：返回 (total_price, overnight, connect_minutes) 或 None。"""
    best = None
    for f in first_opts:
        for s in second_opts:
            if not is_feasible(f.arrive_time, s.depart_time, min_connect_min):
                continue
            total = f.price + s.price
            overnight = s.depart_time.date() > f.arrive_time.date()
            conn = connection_minutes(f.arrive_time, s.depart_time)
            if best is None or total < best[0]:
                best = (total, overnight, conn)
    return best


class _Budget:
    def __init__(self, limit: int):
        self.limit = limit
        self.used = 0

    def spend(self, n: int) -> bool:
        self.used += n
        return self.used <= self.limit


class SelfTransferRule:
    name = "self_transfer"
    enabled = True

    def evaluate(self, ctx: RuleContext) -> list[OpportunityDraft]:
        chain = getattr(ctx, "chain", None)
        if chain is None:                          # 需 provider chain（weekly 注入）
            return []
        rc = ctx.cfg.rules.self_transfer
        hubs, min_conn, insurance = rc.hubs, rc.min_connect_min, rc.insurance_sgd
        budget = _Budget(rc.max_queries)
        drafts: list[OpportunityDraft] = []

        for route in ctx.routes:
            if route.trip_type != "round_trip":
                continue
            o, dest, stay = route.origin, route.dest, int(route.stay_rep or 10)
            cal = sorted(ctx.latest_calendar(route.id), key=lambda r: float(r["price"]))
            for row in cal[:rc.candidate_dates]:
                d = row["depart_date"]
                ret = row["return_date"] or (d + timedelta(days=stay))
                through = float(row["price"])
                best_combo = None
                for hub in hubs:
                    if hub in (o, dest):
                        continue
                    if not budget.spend(6):            # 每 hub 6 次详情；超预算停整个任务
                        log.info("self_transfer 达查询预算上限，停止")
                        return drafts
                    try:
                        o_hub = chain.details(o, hub, d, None)
                        hub_dest = (chain.details(hub, dest, d, None) +
                                    chain.details(hub, dest, d + timedelta(days=1), None))
                        dest_hub = chain.details(dest, hub, ret, None)
                        hub_o = (chain.details(hub, o, ret, None) +
                                 chain.details(hub, o, ret + timedelta(days=1), None))
                    except AllProvidersFailed:
                        continue
                    out = best_leg_pair(o_hub, hub_dest, min_conn)
                    back = best_leg_pair(dest_hub, hub_o, min_conn)
                    if not out or not back:
                        continue
                    combo_price = out[0] + back[0] + insurance
                    if best_combo is None or combo_price < best_combo["price"]:
                        best_combo = {"price": combo_price, "hub": hub,
                                      "overnight": out[1] or back[1],
                                      "min_conn": min(out[2], back[2])}
                if not best_combo:
                    continue
                saving = through - best_combo["price"]
                if saving <= 0 or saving < max(rc.min_pct * through, rc.min_abs):
                    continue

                month = d.strftime("%Y-%m")
                bucket = lead_bucket(d, ctx.today(), ctx.lead_buckets)
                base = ctx.resolve_baseline(route.id, month, bucket)
                stats = grid_stats(ctx.cfg, route.id, month, bucket, through)
                drafts.append(OpportunityDraft(
                    type="self_transfer", route_id=route.id,
                    depart_date=d, return_date=ret,
                    base_price=through, alt_price=best_combo["price"], saving=saving,
                    evidence_snapshot_ids=[row["id"]],
                    detail={
                        "hub": best_combo["hub"],
                        "overnight": best_combo["overnight"],
                        "min_connect_min": best_combo["min_conn"],
                        "percentile_now": stats["pct"],
                        "window_low": stats["wlow"],
                        "low_confidence": base.low_confidence if base else True,
                        "p50": base.p50 if base else None,
                        "carrier": None,
                        "trigger": f"经 {best_combo['hub']} 两票拼接",
                    },
                ))
        return drafts
