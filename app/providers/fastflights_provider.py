"""fast-flights 备用 provider。

T0 VERIFIED.md：安装版本 3.0.2，API 与 Spec §6.3 README 示例不同——
- 用 create_filter(flights=[FlightQuery(...)], trip=, seat=, passengers=, currency=) → Query，
  再 get_flights(query)；无 FlightData/Result 顶层导出，无 fetch_mode。
- 结果为 ResultList[Flights]；Flights.price 已是**数值 int**（按 create_filter 的 currency 计价，
  本项目请求 SGD），Flights.airlines 是**承运人全名列表**（非二字码），Flights.flights 是各段。
- 默认抓取器偶发解析 IndexError（Google 页面结构波动）→ 本文件内做少量重试。
- 无区间接口 → calendar() 降级为隔日单查循环（每航线 ≤ 30 次），仅 fli 失效时由 chain 触发。
"""
import logging
from datetime import date, datetime, timedelta

from .base import CalendarPoint, DetailOption, ProviderError, ProviderUnavailable

log = logging.getLogger("fareradar.fastflights")

try:
    from fast_flights import FlightQuery, Passengers, create_filter, get_flights
except ImportError as e:
    raise ProviderUnavailable(f"fast_flights import failed: {e}")

_MAX_TRIES = 3
_CALENDAR_STEP_DAYS = 2
_CALENDAR_MAX_POINTS = 30


def _name_to_code() -> dict:
    """承运人全名 → 二字码（借 fli Airline 枚举，best-effort）；fli 不可用则空表。"""
    try:
        from fli.models import Airline
        return {a.value: a.name for a in Airline}
    except Exception:
        return {}


_NAME2CODE = _name_to_code()


def _carrier_code(airlines: list[str]) -> str | None:
    if not airlines:
        return None
    name = airlines[0]
    if name in _NAME2CODE:
        return _NAME2CODE[name]
    # 前缀匹配兜底（fast-flights 用简称 "Hainan"，fli 用 "Hainan Airlines"）
    for full, code in _NAME2CODE.items():
        if full.startswith(name) or name.startswith(full):
            return code
    return name  # 无法映射时如实保留原名（risk 层按非 LCC 处理，不崩溃）


def _to_dt(sdt) -> datetime | None:
    try:
        y, m, d = sdt.date
        hh, mm = sdt.time
        return datetime(y, m, d, hh, mm)
    except Exception:
        return None


def _query(origin, dest, dep: date, ret: date | None, currency: str, pax: int):
    flights = [FlightQuery(date=dep.isoformat(), from_airport=origin, to_airport=dest)]
    trip = "one-way"
    if ret is not None:
        flights.append(FlightQuery(date=ret.isoformat(), from_airport=dest, to_airport=origin))
        trip = "round-trip"
    q = create_filter(flights=flights, trip=trip, seat="economy",
                      passengers=Passengers(adults=pax), currency=currency)
    last = None
    for _ in range(_MAX_TRIES):
        try:
            res = get_flights(q)
            if res:
                return list(res)
        except Exception as e:  # noqa: 偶发解析错误，重试
            last = e
    if last:
        raise ProviderError(f"fast_flights fetch failed: {last}")
    return []


class FastFlightsProvider:
    name = "fast_flights"

    def __init__(self, currency: str, cabin: str, pax: int):
        self.currency, self.cabin, self.pax = currency, cabin, pax

    def details(self, origin, dest, depart_date: date, return_date=None):
        rows = _query(origin, dest, depart_date, return_date, self.currency, self.pax)
        out = []
        for f in rows[:10]:
            price = getattr(f, "price", 0)
            legs = getattr(f, "flights", None) or []
            if not price or price <= 0 or not legs:
                continue
            out.append(DetailOption(
                price=float(price),
                currency=self.currency,          # create_filter 已按 SGD 计价
                carrier=_carrier_code(getattr(f, "airlines", []) or []),
                stops=max(len(legs) - 1, 0),
                depart_time=_to_dt(legs[0].departure),
                arrive_time=_to_dt(legs[-1].arrival),
            ))
        if not out:
            raise ProviderError("fast_flights returned empty result")
        return out

    def calendar(self, origin, dest, date_from: date, date_to: date,
                 trip_type: str, stay_rep):
        """降级语义：隔日采样单日查询（fli 失效时才由 chain 调用）。"""
        is_rt = trip_type == "round_trip"
        points, day, count = [], date_from, 0
        while day <= date_to and count < _CALENDAR_MAX_POINTS:
            ret = day + timedelta(days=int(stay_rep or 10)) if is_rt else None
            try:
                rows = _query(origin, dest, day, ret, self.currency, self.pax)
                prices = [float(f.price) for f in rows if getattr(f, "price", 0) and f.price > 0]
                if prices:
                    points.append(CalendarPoint(depart_date=day, return_date=ret,
                                                price=min(prices), currency=self.currency))
            except ProviderError as e:
                log.warning("fast_flights calendar %s->%s %s: %s", origin, dest, day, e)
            day += timedelta(days=_CALENDAR_STEP_DAYS)
            count += 1
        if not points:
            raise ProviderError("fast_flights calendar returned empty")
        return points
