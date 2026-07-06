"""规则纯逻辑单测（§13.1）：
breach 触发/不触发（含无基线跳过）；date_shift 阈值 max(15%,50) 两侧；
nearby 折算加价后比较；self_transfer 衔接 239/240/241min 判定与 overnight；组合缺时刻→不可行。
"""
from datetime import datetime

from app.providers.base import DetailOption
from app.signals.rules.baseline_breach import is_breach
from app.signals.rules.date_shift import date_shift_triggered
from app.signals.rules.nearby_airport import nearby_triggered
from app.signals.rules.self_transfer import best_leg_pair, connection_minutes, is_feasible


# ------------------------------------------------------ breach 触发/不触发 --

def test_breach_triggers_below_p15():
    assert is_breach(250.0, p15=300.0, p50=412.0, force=False) is True


def test_breach_not_triggered_above_p15():
    assert is_breach(350.0, p15=300.0, p50=412.0, force=False) is False


def test_breach_no_baseline_skips():
    assert is_breach(100.0, p15=None, p50=None, force=False) is False


def test_breach_force_always_true():
    assert is_breach(999.0, p15=300.0, p50=412.0, force=True) is True   # < p50*10


# --------------------------------------------- date_shift 阈值 max(15%,50) --

def test_date_shift_pct_side():
    # center=400：threshold=max(60,50)=60
    assert date_shift_triggered(400.0, 340.0, 0.15, 50.0) is True       # saving 60
    assert date_shift_triggered(400.0, 345.0, 0.15, 50.0) is False      # saving 55 < 60


def test_date_shift_abs_side():
    # center=200：threshold=max(30,50)=50
    assert date_shift_triggered(200.0, 145.0, 0.15, 50.0) is True       # saving 55
    assert date_shift_triggered(200.0, 155.0, 0.15, 50.0) is False      # saving 45 < 50


# --------------------------------------------- nearby 折算加价后比较 --------

def test_nearby_trigger_with_adder():
    # base=500, shadow=400, adder=40 → eff=440, saving=60；threshold=max(60,60)=60
    assert nearby_triggered(500.0, 400.0, 40.0, 0.12, 60.0) is True
    # shadow=410 → eff=450, saving=50 < 60
    assert nearby_triggered(500.0, 410.0, 40.0, 0.12, 60.0) is False


# --------------------------------------------- self_transfer 衔接判定 ------

def _opt(price, dep, arr):
    return DetailOption(price=price, currency="SGD", carrier="XX", stops=0,
                        depart_time=dep, arrive_time=arr)


def test_connection_boundary_239_240_241():
    base = datetime(2026, 8, 21, 10, 0)
    arr = base
    assert is_feasible(arr, base.replace(hour=13, minute=59), 240) is False   # 239min
    assert is_feasible(arr, base.replace(hour=14, minute=0), 240) is True     # 240min
    assert is_feasible(arr, base.replace(hour=14, minute=1), 240) is True     # 241min


def test_connection_missing_time_infeasible():
    base = datetime(2026, 8, 21, 10, 0)
    assert is_feasible(None, base, 240) is False
    assert is_feasible(base, None, 240) is False
    assert connection_minutes(None, base) is None


def test_best_leg_pair_overnight_flag():
    arr = datetime(2026, 8, 21, 22, 0)
    first = [_opt(100.0, datetime(2026, 8, 21, 18, 0), arr)]
    # 次日凌晨起飞的第二段 → overnight
    second = [_opt(120.0, datetime(2026, 8, 22, 8, 0), datetime(2026, 8, 22, 12, 0))]
    res = best_leg_pair(first, second, 240)
    assert res is not None
    total, overnight, conn = res
    assert total == 220.0
    assert overnight is True


def test_best_leg_pair_infeasible_returns_none():
    arr = datetime(2026, 8, 21, 10, 0)
    first = [_opt(100.0, datetime(2026, 8, 21, 6, 0), arr)]
    second = [_opt(120.0, datetime(2026, 8, 21, 12, 0), datetime(2026, 8, 21, 15, 0))]  # 120min < 240
    assert best_leg_pair(first, second, 240) is None
