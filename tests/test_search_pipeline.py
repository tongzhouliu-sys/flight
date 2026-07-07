"""实时搜索管线单测（离线，不连库、不联网）。

用假 ProviderChain 注入日历数据，验证 date_shift 触发、JSON 形状、risk/suggest 复用，
以及 SearchQuery 参数校验。冷启动走 serpapi，测试里恒失败 → 任意航线不产 baseline_breach。
"""
from datetime import date, timedelta

import pytest

from app.providers.base import CalendarPoint, DetailOption
from app.providers.chain import AllProvidersFailed
from app.search import cache, expander, pipeline
from app.search.errors import SearchInputError
from app.search.models import SearchQuery


class FakeChain:
    """只实现管线用到的三个方法；不触库、不联网。"""
    last_provider = "fake"

    def __init__(self, points, detail=None):
        self._points = points
        self._detail = detail

    def calendar(self, origin, dest, date_from, date_to, trip_type, stay_rep):
        pts = [p for p in self._points if date_from <= p.depart_date <= date_to]
        if not pts:
            raise AllProvidersFailed("empty")
        return pts

    def details(self, origin, dest, depart_date, return_date):
        return [self._detail] if self._detail else []

    def price_insights(self, origin, dest, probe_date):
        raise AllProvidersFailed("no serpapi in test")


@pytest.fixture(autouse=True)
def _isolate(monkeypatch):
    cache.clear()
    # 任意航线：非监控 → 不查 DB 基线
    monkeypatch.setattr(expander, "find_route", lambda o, d: None)
    yield
    cache.clear()


def _points(center: date):
    """中心价 1000，中心前一天 700（更便宜），其余较贵。"""
    return [
        CalendarPoint(center - timedelta(days=1), None, 700.0, "SGD"),
        CalendarPoint(center, None, 1000.0, "SGD"),
        CalendarPoint(center + timedelta(days=1), None, 1050.0, "SGD"),
    ]


def _query(center: date, date_mode="flex3"):
    return SearchQuery.parse({
        "origin": "sin", "dest": "hkg", "depart_date": center.isoformat(),
        "trip_type": "one_way", "cabin": "ECONOMY", "adults": 1, "date_mode": date_mode,
    })


def test_date_shift_triggers_and_shapes_json():
    center = date.today() + timedelta(days=40)
    q = _query(center)
    chain = FakeChain(_points(center), detail=DetailOption(700.0, "SGD", "SQ", 0, None, None))

    out = pipeline.run_search(q, chain=chain, use_cache=False)

    assert out["meta"]["provider"] == "fake"
    assert len(out["results"]) == 3
    ops = out["opportunities"]
    assert len(ops) == 1
    op = ops[0]
    assert op["type"] == "date_shift"
    assert op["saving"] == 300.0
    assert op["base_price"] == 1000.0 and op["alt_price"] == 700.0
    assert 1 <= op["stars"] <= 4
    assert op["action"] in ("立即买", "关注")
    assert op["risk_score"] is None and op["recommendation_score"] is None
    assert op["explain"]["text"]
    assert op["deeplink"].startswith("https://www.google.com/travel/flights")


def test_no_opportunity_when_center_is_cheapest():
    center = date.today() + timedelta(days=40)
    pts = [
        CalendarPoint(center, None, 700.0, "SGD"),
        CalendarPoint(center + timedelta(days=1), None, 1000.0, "SGD"),
    ]
    q = _query(center)
    out = pipeline.run_search(q, chain=FakeChain(pts), use_cache=False)
    assert out["opportunities"] == []


def test_cache_marks_hit():
    center = date.today() + timedelta(days=40)
    q = _query(center)
    chain = FakeChain(_points(center))
    first = pipeline.run_search(q, chain=chain, use_cache=True)
    assert first["meta"]["cached"] is False
    second = pipeline.run_search(q, chain=chain, use_cache=True)
    assert second["meta"]["cached"] is True


def test_input_validation():
    with pytest.raises(SearchInputError):
        SearchQuery.parse({"origin": "SIN", "dest": "SIN", "date_mode": "exact",
                           "depart_date": "2026-08-01"})
    with pytest.raises(SearchInputError):
        SearchQuery.parse({"origin": "SIN", "dest": "HKG", "cabin": "SUPER",
                           "date_mode": "exact", "depart_date": "2026-08-01"})
    with pytest.raises(SearchInputError):
        SearchQuery.parse({"origin": "SIN", "dest": "HKG", "trip_type": "round_trip",
                           "date_mode": "exact", "depart_date": "2026-08-01"})  # 缺 return_date
