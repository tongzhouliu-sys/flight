"""Provider Adapter：按请求 cabin/pax 构造现有 ProviderChain 并封装实时抓价。

复用 app.providers.chain.ProviderChain（预算/降级/入账逻辑不变）。
冷启动基线复用 app.baseline.engine.derive_coldstart。
"""
from datetime import date

from app.baseline.engine import derive_coldstart
from app.providers.chain import AllProvidersFailed, ProviderChain
from app.search.errors import SearchError
from app.settings import load_config


def build_chain(cabin: str, pax: int) -> ProviderChain:
    """load_config 每次返回全新命名空间，直接覆盖 cabin/pax（不影响其他调用）。"""
    cfg = load_config()
    cfg.cabin = cabin
    cfg.pax = pax
    return ProviderChain(cfg)


def fetch_calendar(chain: ProviderChain, plan) -> list:
    try:
        return chain.calendar(plan.origin, plan.dest, plan.date_from,
                              plan.date_to, plan.trip_type, plan.stay_rep)
    except AllProvidersFailed as e:
        raise SearchError(f"无法获取 {plan.origin}→{plan.dest} 实时价格：{e}")


def fetch_variant_calendar(chain: ProviderChain, plan, variant: str) -> list:
    """邻近机场影子日历（替换目的地）。失败视作无影子数据，交由上层跳过。"""
    try:
        return chain.calendar(plan.origin, variant, plan.date_from,
                              plan.date_to, plan.trip_type, plan.stay_rep)
    except AllProvidersFailed as e:
        raise SearchError(str(e))


def fetch_cheapest_detail(chain: ProviderChain, plan, depart_date: date, return_date):
    """对最便宜日期钻取一次详情，取最低价选项的 carrier/stops。失败返回 None。"""
    try:
        opts = chain.details(plan.origin, plan.dest, depart_date, return_date)
    except AllProvidersFailed:
        return None
    if not opts:
        return None
    return min(opts, key=lambda o: float(o.price))


def fetch_coldstart_baseline(chain: ProviderChain, origin: str, dest: str,
                             probe_date: date, cfg) -> dict | None:
    """任意航线冷启动基线：serpapi price_insights → derive_coldstart。预算不足/失败返回 None。"""
    try:
        insights = chain.price_insights(origin, dest, probe_date)
    except AllProvidersFailed:
        return None
    low = insights.get("range_low")
    high = insights.get("range_high")
    if low is None or high is None:
        return None
    return derive_coldstart(float(low), float(high), cfg.alerts.coldstart_factor)
