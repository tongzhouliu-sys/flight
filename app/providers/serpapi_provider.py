"""SerpAPI（google_flights 引擎）兜底 provider + 冷启动 price_insights 源。

需 SERPAPI_KEY；缺失 → 构造期 ProviderUnavailable，降级链跳过。
无区间能力：calendar() 抛 ProviderError，chain 对 calendar 请求跳过本级。
"""
from datetime import date, datetime

import httpx

from app.settings import settings

from .base import DetailOption, ProviderError, ProviderUnavailable

_ENDPOINT = "https://serpapi.com/search"


def _parse_time(s: str | None) -> datetime | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return None


def _carrier_from_flight_number(fn: str | None) -> str | None:
    # SerpAPI flight_number 形如 "TR 123" → 取二字码前缀
    if not fn:
        return None
    head = fn.strip().split()[0]
    return head[:2].upper() if head else None


class SerpApiProvider:
    name = "serpapi"

    def __init__(self, currency: str, cabin: str, pax: int):
        if not settings.SERPAPI_KEY:
            raise ProviderUnavailable("SERPAPI_KEY 未设置")
        self.currency, self.cabin, self.pax = currency, cabin, pax
        self.key = settings.SERPAPI_KEY

    def _get(self, params: dict) -> dict:
        params = {**params, "engine": "google_flights", "currency": self.currency,
                  "hl": "en", "api_key": self.key}
        try:
            r = httpx.get(_ENDPOINT, params=params, timeout=30)
            r.raise_for_status()
            return r.json()
        except Exception as e:
            raise ProviderError(f"serpapi request failed: {e}")

    def details(self, origin, dest, depart_date: date, return_date=None):
        params = {
            "departure_id": origin, "arrival_id": dest,
            "outbound_date": depart_date.isoformat(),
            "type": "1" if return_date else "2",       # 1=往返, 2=单程
        }
        if return_date:
            params["return_date"] = return_date.isoformat()
        data = self._get(params)
        flights = (data.get("best_flights") or []) + (data.get("other_flights") or [])
        out = []
        for itin in flights[:10]:
            price = itin.get("price")
            legs = itin.get("flights") or []
            if not price or not legs:
                continue
            leg0, legN = legs[0], legs[-1]
            # 中转城市：各段到达机场（除最后一段）即中转点
            layover_cities = []
            for leg in legs[:-1]:
                arr_info = leg.get("arrival_airport") or {}
                code = arr_info.get("id")
                if code and len(code) == 3:
                    layover_cities.append(code)
            out.append(DetailOption(
                price=float(price),
                currency=self.currency,
                carrier=_carrier_from_flight_number(leg0.get("flight_number")),
                stops=max(len(legs) - 1, 0),
                depart_time=_parse_time((leg0.get("departure_airport") or {}).get("time")),
                arrive_time=_parse_time((legN.get("arrival_airport") or {}).get("time")),
                layover_cities=layover_cities if layover_cities else None,
            ))
        if not out:
            raise ProviderError("serpapi returned empty result")
        return out

    def calendar(self, origin, dest, date_from: date, date_to: date,
                 trip_type: str, stay_rep):
        raise ProviderError("serpapi has no calendar range support")

    def price_insights(self, origin, dest, probe_date: date) -> dict:
        """§8 冷启动：返回 {range_low, range_high, history}。"""
        data = self._get({
            "departure_id": origin, "arrival_id": dest,
            "outbound_date": probe_date.isoformat(), "type": "2",
        })
        pi = data.get("price_insights") or {}
        tpr = pi.get("typical_price_range") or [None, None]
        if not tpr or tpr[0] is None or tpr[1] is None:
            raise ProviderError("serpapi price_insights missing typical_price_range")
        return {
            "range_low": float(tpr[0]),
            "range_high": float(tpr[1]),
            "history": pi.get("price_history") or [],
        }
