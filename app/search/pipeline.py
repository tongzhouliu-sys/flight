"""实时机会编排：复用现有规则纯判定 + assess_risk + suggest。

对一次实时抓取的日历数据，逐类构造 OpportunityDraft（与既有规则同款 detail），
交给 assess_risk / suggest 得到风险标签与建议档；输出 JSON（含 risk_score/
recommendation_score=null 占位）。实时机会不落库。
"""
import logging

from app.baseline.engine import (grid_stats, lead_bucket, resolve_baseline_db)
from app.notify.cards import deeplink, suggest
from app.settings import currency_symbol, load_baggage, load_config, now_sgt, today_sgt
from app.signals.engine import OpportunityDraft
from app.signals.risk import assess_risk
from app.signals.rules.baseline_breach import is_breach
from app.signals.rules.date_shift import date_shift_triggered
from app.signals.rules.nearby_airport import nearby_triggered

from app.search import adapter, cache
from app.search.errors import SearchError
from app.search.expander import expand
from app.search.models import TYPE_LABELS, SearchQuery

log = logging.getLogger("fareradar.search")


# ------------------------------------------------------------- 公开入口 ------

def run_search(query: SearchQuery, chain=None, use_cache: bool = True) -> dict:
    if use_cache:
        cached = cache.get(query.cache_key())
        if cached is not None:
            out = dict(cached)
            out["meta"] = {**cached["meta"], "cached": True}
            return out

    result = _run(query, chain)
    if use_cache:
        cache.put(query.cache_key(), result)
    return result


def _run(query: SearchQuery, chain) -> dict:
    cfg = load_config()
    plan = expand(query)
    if chain is None:
        chain = adapter.build_chain(query.cabin, query.adults)

    calendar = adapter.fetch_calendar(chain, plan)
    if not calendar:
        raise SearchError("该航线暂无可用实时价格")

    points = sorted(calendar, key=lambda p: p.depart_date)
    prices = [float(p.price) for p in points]
    currency = points[0].currency
    cheapest = min(points, key=lambda p: float(p.price))

    # 仅对最便宜日期钻取一次详情（carrier/stops），控制外呼次数
    detail_opt = adapter.fetch_cheapest_detail(chain, plan, cheapest.depart_date, cheapest.return_date)
    cheap_carrier = detail_opt.carrier if detail_opt else None
    cheap_stops = detail_opt.stops if detail_opt else None

    baggage = load_baggage()
    drafts: list[OpportunityDraft] = []

    ds = _date_shift_draft(cfg, query, plan, points, cheapest, cheap_carrier, cheap_stops, prices)
    if ds:
        drafts.append(ds)

    bb = _baseline_breach_draft(cfg, query, plan, cheapest, cheap_carrier, cheap_stops, prices, chain)
    if bb:
        drafts.append(bb)

    drafts.extend(_nearby_drafts(cfg, query, plan, points, chain))

    opportunities = []
    for d in drafts:
        risk = assess_risk(cfg, baggage, d)
        if risk.hard_block:
            continue
        stars, action, color = suggest(d, risk)
        opportunities.append(_serialize_opportunity(query, d, risk, stars, action, color, currency))
    opportunities.sort(key=lambda o: o["saving"], reverse=True)

    return {
        "query": query.as_dict(),
        "results": [
            _serialize_point(p, currency,
                             cheap_carrier if p is cheapest else None,
                             cheap_stops if p is cheapest else None)
            for p in points
        ],
        "opportunities": opportunities,
        "meta": {
            "provider": chain.last_provider,
            "cached": False,
            "fetched_at": now_sgt().isoformat(),
            "monitored_route_id": plan.monitored_route_id,
            "currency": currency,
            "point_count": len(points),
        },
    }


# ------------------------------------------------------------ draft 构造 -----

def _baseline_ctx(cfg, route_id, d, price):
    """监控航线：真实 DB 基线 + 分位。返回 (p10,p15,p50,low_conf,pct,wlow) 或 None。"""
    month = d.strftime("%Y-%m")
    bucket = lead_bucket(d, today_sgt(), vars(cfg.baseline.lead_buckets))
    base = resolve_baseline_db(route_id, month, bucket, cfg.baseline.min_sample)
    if base is None:
        return None
    stats = grid_stats(cfg, route_id, month, bucket, price)
    return base.p10, base.p15, base.p50, base.low_confidence, stats["pct"], stats["wlow"]


def _date_shift_draft(cfg, query, plan, points, cheapest, carrier, stops, prices):
    if plan.center_date is None or len(points) < 2:
        return None
    by_date = {p.depart_date: p for p in points}
    center_row = by_date.get(plan.center_date)
    if center_row is None:
        return None
    center_price = float(center_row.price)
    best = cheapest
    best_price = float(best.price)
    if best.depart_date == plan.center_date:
        return None
    rc = cfg.rules.date_shift
    if not date_shift_triggered(center_price, best_price, rc.min_pct, rc.min_abs):
        return None

    pct, wlow, low_conf, p50 = _window_pct(prices, best_price), min(prices), True, None
    if plan.monitored_route_id:
        ctx = _baseline_ctx(cfg, plan.monitored_route_id, best.depart_date, best_price)
        if ctx:
            _, _, p50, low_conf, pct, wlow = ctx

    return OpportunityDraft(
        type="date_shift",
        route_id=plan.monitored_route_id or f"{query.origin}-{query.dest}",
        depart_date=best.depart_date, return_date=best.return_date,
        base_price=center_price, alt_price=best_price, saving=center_price - best_price,
        evidence_snapshot_ids=[],
        detail={
            "best_date": best.depart_date.isoformat(),
            "center_date": plan.center_date.isoformat(),
            "percentile_now": pct, "window_low": wlow, "low_confidence": low_conf,
            "p50": p50, "carrier": carrier, "stops": stops,
            "trigger": f"±灵活日期 最优 {best.depart_date.isoformat()}",
        },
    )


def _baseline_breach_draft(cfg, query, plan, cheapest, carrier, stops, prices, chain):
    price = float(cheapest.price)
    d = cheapest.depart_date
    p10 = p15 = p50 = None
    low_conf, pct, wlow = True, _window_pct(prices, price), min(prices)

    if plan.monitored_route_id:
        ctx = _baseline_ctx(cfg, plan.monitored_route_id, d, price)
        if ctx:
            p10, p15, p50, low_conf, pct, wlow = ctx
    else:
        cold = adapter.fetch_coldstart_baseline(chain, query.origin, query.dest, d, cfg)
        if cold:
            p10, p15, p50 = cold["p10"], cold["p15"], cold["p50"]

    if p15 is None or p50 is None:
        return None
    if not is_breach(price, p15, p50, False):
        return None

    return OpportunityDraft(
        type="baseline_breach",
        route_id=plan.monitored_route_id or f"{query.origin}-{query.dest}",
        depart_date=d, return_date=cheapest.return_date,
        base_price=p50, alt_price=price, saving=p50 - price,
        evidence_snapshot_ids=[],
        detail={
            "percentile_now": pct, "window_low": wlow, "low_confidence": low_conf,
            "p10": p10, "p15": p15, "p50": p50, "carrier": carrier, "stops": stops,
            "trigger": "阈值 P15",
        },
    )


def _nearby_drafts(cfg, query, plan, points, chain):
    if not plan.nearby_variants:
        return []
    rc = cfg.rules.nearby
    adder = rc.adder_sgd
    prices = [float(p.price) for p in points]
    orig = {p.depart_date: p for p in points}
    out: list[OpportunityDraft] = []

    for variant in plan.nearby_variants:
        try:
            shadow_points = adapter.fetch_variant_calendar(chain, plan, variant)
        except SearchError:
            continue
        shadow = {p.depart_date: p for p in shadow_points}
        best_draft = None
        for dep, orow in orig.items():
            srow = shadow.get(dep)
            if srow is None:
                continue
            base_price = float(orow.price)
            shadow_price = float(srow.price)
            if not nearby_triggered(base_price, shadow_price, adder, rc.min_pct, rc.min_abs):
                continue
            effective = shadow_price + adder
            draft = OpportunityDraft(
                type="nearby_airport",
                route_id=plan.monitored_route_id or f"{query.origin}-{query.dest}",
                depart_date=dep, return_date=orow.return_date,
                base_price=base_price, alt_price=effective, saving=base_price - effective,
                evidence_snapshot_ids=[],
                detail={
                    "variant": variant, "adder_sgd": adder, "shadow_price": shadow_price,
                    "percentile_now": _window_pct(prices, base_price), "window_low": min(prices),
                    "low_confidence": True, "p50": None, "carrier": None, "stops": None,
                    "trigger": f"经 {variant} 折算 +{adder}",
                },
            )
            if best_draft is None or draft.saving > best_draft.saving:
                best_draft = draft
        if best_draft is not None:
            out.append(best_draft)
    return out


# ------------------------------------------------------------ 序列化 --------

def _window_pct(prices: list[float], price: float) -> int | None:
    if not prices:
        return None
    return round(100.0 * sum(1 for p in prices if p <= price) / len(prices))


def _serialize_point(p, currency, carrier, stops) -> dict:
    return {
        "depart_date": p.depart_date.isoformat(),
        "return_date": p.return_date.isoformat() if p.return_date else None,
        "price": round(float(p.price), 2),
        "currency": p.currency,
        "carrier": carrier,
        "stops": stops,
    }


def _serialize_opportunity(query, d, risk, stars, action, color, currency) -> dict:
    return {
        "type": d.type,
        "type_label": TYPE_LABELS.get(d.type, d.type),
        "origin": query.origin,
        "dest": query.dest,
        "route_id": d.route_id,
        "depart_date": d.depart_date.isoformat() if d.depart_date else None,
        "return_date": d.return_date.isoformat() if d.return_date else None,
        "base_price": round(float(d.base_price), 2),
        "alt_price": round(float(d.alt_price), 2),
        "saving": round(float(d.saving), 2),
        "currency": currency,
        "risk_tags": list(risk.tags),
        "hard_block": risk.hard_block,
        "effective_total": round(float(risk.effective_total), 2) if risk.effective_total is not None else None,
        "baggage_fee": round(float(risk.baggage_fee), 2) if risk.baggage_fee is not None else None,
        "stars": stars,
        "action": action,
        "action_color": color,
        "risk_score": None,               # 占位：未来后端评分模型填充
        "recommendation_score": None,     # 占位：同上
        "explain": _build_explain(query, d, currency),
        "detail": _jsonable(d.detail),
        "deeplink": deeplink(query.origin, query.dest, d.depart_date, d.return_date),
    }


def _build_explain(query, d, currency) -> dict:
    s = currency_symbol(currency)
    detail = d.detail
    label = TYPE_LABELS.get(d.type, d.type)
    saving = float(d.saving)
    base = round(float(d.base_price), 2)
    alt = round(float(d.alt_price), 2)
    route = f"{query.origin}→{query.dest}"

    if d.type == "date_shift":
        frm = {"label": detail.get("center_date"), "price": base}
        to = {"label": detail.get("best_date"), "price": alt}
    elif d.type == "nearby_airport":
        frm = {"label": query.dest, "price": base}
        to = {"label": f"{detail.get('variant')}(+{detail.get('adder_sgd')})", "price": alt}
    else:  # baseline_breach
        frm = {"label": "基线中位 P50", "price": base}
        to = {"label": d.depart_date.isoformat() if d.depart_date else "", "price": alt}

    headline = f"{label} · 省{s}{saving:.0f}"
    text = f"{headline} | {route} {frm['label']} ({s}{frm['price']:.0f}) ➔ {to['label']} ({s}{to['price']:.0f})"
    return {"headline": headline, "route": route, "from": frm, "to": to,
            "note": detail.get("trigger", ""), "text": text}


def _jsonable(detail: dict) -> dict:
    """detail 值均为 str/int/float/bool/None（日期已 isoformat）；Decimal → float 以确保可序列化。"""
    from decimal import Decimal
    return {k: (float(v) if isinstance(v, Decimal) else v) for k, v in detail.items()}
