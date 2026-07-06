"""fli（PyPI `flights`）主力 provider。

契约（base.py）不变；本文件按 T0 VERIFIED.md 消化真实 API 差异：
- currency 是 SearchFlights/SearchDates.search() 的入参，非 filter 字段；
- 承运人二字码 = Airline 枚举成员名 `.name`（`.value` 是全名，不可用于 LCC 索引）；
- 日期区间搜索 = SearchDates + DateSearchFilters(from_date/to_date/duration)；
- round_trip 需 2 个 segment，两段 travel_date 差 == duration(stay_rep)；
- DatePrice.date 是 datetime 元组：(depart,) 或 (depart, return)；
- FlightResult.price 可能为 None，须过滤。
"""
from datetime import date, timedelta

from .base import CalendarPoint, DetailOption, ProviderError, ProviderUnavailable

try:
    from fli.models import (Airport, DateSearchFilters, FlightSearchFilters,
                            FlightSegment, MaxStops, PassengerInfo, SeatType,
                            SortBy, TripType)
    from fli.search import SearchDates, SearchFlights
except ImportError as e:  # 构造期不可用 → 降级链跳过
    raise ProviderUnavailable(f"fli import failed: {e}")


def _airport(code: str):
    try:
        return Airport[code]
    except KeyError:
        raise ProviderError(f"fli Airport enum missing {code}")


def _outbound(result):
    """round_trip 结果是 (outbound, return, ...) 元组；one_way 是 FlightResult。取外程作代表。"""
    return result[0] if isinstance(result, tuple) else result


class FliProvider:
    name = "fli"

    def __init__(self, currency: str, cabin: str, pax: int):
        self.currency, self.cabin, self.pax = currency, cabin, pax

    # -------------------------------------------------------------- details --
    def details(self, origin, dest, depart_date: date, return_date=None):
        is_rt = return_date is not None
        segs = [FlightSegment(departure_airport=[[_airport(origin), 0]],
                              arrival_airport=[[_airport(dest), 0]],
                              travel_date=depart_date.isoformat())]
        if is_rt:
            segs.append(FlightSegment(departure_airport=[[_airport(dest), 0]],
                                      arrival_airport=[[_airport(origin), 0]],
                                      travel_date=return_date.isoformat()))
        filters = FlightSearchFilters(
            trip_type=TripType.ROUND_TRIP if is_rt else TripType.ONE_WAY,
            passenger_info=PassengerInfo(adults=self.pax),
            flight_segments=segs,
            seat_type=SeatType[self.cabin],
            stops=MaxStops.ANY,
            sort_by=SortBy.CHEAPEST,
        )
        try:
            results = SearchFlights().search(filters, top_n=10, currency=self.currency)
        except Exception as e:
            raise ProviderError(str(e))
        out = []
        for r in (results or []):
            f = _outbound(r)
            legs = getattr(f, "legs", None) or []
            if f.price is None or not legs:
                continue
            leg0 = legs[0]
            out.append(DetailOption(
                price=float(f.price),
                currency=(f.currency or self.currency),
                carrier=leg0.airline.name,          # 二字码（VERIFIED.md）
                stops=getattr(f, "stops", None),
                depart_time=getattr(leg0, "departure_datetime", None),
                arrive_time=getattr(legs[-1], "arrival_datetime", None),
            ))
        if not out:
            raise ProviderError("fli returned empty result")
        return out

    # ------------------------------------------------------------- calendar --
    def calendar(self, origin, dest, date_from: date, date_to: date,
                 trip_type: str, stay_rep):
        is_rt = trip_type == "round_trip"
        segs = [FlightSegment(departure_airport=[[_airport(origin), 0]],
                              arrival_airport=[[_airport(dest), 0]],
                              travel_date=date_from.isoformat())]
        duration = None
        if is_rt:
            duration = int(stay_rep or 10)
            ret0 = date_from + timedelta(days=duration)   # 两段差须等于 duration
            segs.append(FlightSegment(departure_airport=[[_airport(dest), 0]],
                                      arrival_airport=[[_airport(origin), 0]],
                                      travel_date=ret0.isoformat()))
        try:
            filters = DateSearchFilters(
                trip_type=TripType.ROUND_TRIP if is_rt else TripType.ONE_WAY,
                passenger_info=PassengerInfo(adults=self.pax),
                flight_segments=segs,
                seat_type=SeatType[self.cabin],
                stops=MaxStops.ANY,
                from_date=date_from.isoformat(),
                to_date=date_to.isoformat(),
                duration=duration,
            )
            results = SearchDates().search(filters, currency=self.currency)
        except Exception as e:
            raise ProviderError(str(e))
        points = []
        for r in (results or []):
            dep = r.date[0].date()
            ret = r.date[1].date() if len(r.date) > 1 else None
            points.append(CalendarPoint(
                depart_date=dep, return_date=ret,
                price=float(r.price), currency=(r.currency or self.currency)))
        if not points:
            raise ProviderError("fli dates returned empty")
        return points
