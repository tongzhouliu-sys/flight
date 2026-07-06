"""基线纯函数单测（§13.1）：lead_bucket 边界、resolve_baseline 四分支、冷启动派生值。"""
from datetime import date, timedelta

from app.baseline.engine import Baseline, derive_coldstart, lead_bucket, resolve_baseline


def _b(source, sample_n, low_conf, p50=400.0):
    return Baseline(route_id="R1", travel_month="2026-08", lead_bucket="L1",
                    p10=300.0, p15=320.0, p25=350.0, p50=p50,
                    sample_n=sample_n, low_confidence=low_conf, source=source)


# ------------------------------------------------------ lead_bucket 边界 ----

def test_lead_bucket_boundaries(lead_buckets, today):
    assert lead_bucket(today + timedelta(days=0), today, lead_buckets) == "L0"
    assert lead_bucket(today + timedelta(days=13), today, lead_buckets) == "L0"
    assert lead_bucket(today + timedelta(days=14), today, lead_buckets) == "L1"
    assert lead_bucket(today + timedelta(days=56), today, lead_buckets) == "L1"
    assert lead_bucket(today + timedelta(days=57), today, lead_buckets) == "L2"
    assert lead_bucket(today + timedelta(days=9999), today, lead_buckets) == "L2"


def test_lead_bucket_past_clamps_l0(lead_buckets, today):
    assert lead_bucket(today - timedelta(days=5), today, lead_buckets) == "L0"


# -------------------------------------------------- resolve_baseline 四分支 --

def test_resolve_self_sufficient_wins():
    s = _b("self", sample_n=40, low_conf=False)
    c = _b("coldstart", sample_n=0, low_conf=True)
    assert resolve_baseline(s, c, min_sample=30) is s


def test_resolve_self_insufficient_falls_to_cold():
    s = _b("self", sample_n=10, low_conf=True)
    c = _b("coldstart", sample_n=0, low_conf=True)
    assert resolve_baseline(s, c, min_sample=30) is c


def test_resolve_self_insufficient_no_cold_returns_self():
    s = _b("self", sample_n=10, low_conf=True)
    assert resolve_baseline(s, None, min_sample=30) is s


def test_resolve_none_when_no_data():
    assert resolve_baseline(None, None, min_sample=30) is None


def test_resolve_cold_only():
    c = _b("coldstart", sample_n=0, low_conf=True)
    assert resolve_baseline(None, c, min_sample=30) is c


# -------------------------------------------------- 冷启动派生值 ------------

def test_derive_coldstart_values():
    d = derive_coldstart(range_low=200.0, range_high=400.0, coldstart_factor=0.95)
    assert d["p25"] == 200.0
    assert d["p50"] == 300.0
    assert d["p15"] == 200.0 * 0.95      # 190.0
    assert d["p10"] == 200.0 * 0.90      # 180.0
