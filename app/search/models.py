"""实时搜索管线的输入结构与展示常量（不依赖 FastAPI；纯 dataclass）。"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from app.search.errors import SearchInputError

# fli SeatType 名（fli_provider 以 SeatType[cabin] 索引）
VALID_CABINS = ("ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST")
VALID_TRIP_TYPES = ("one_way", "round_trip")
VALID_DATE_MODES = ("exact", "flex3", "next7", "next30")

# 机会类型中文标签（与 dashboard._TYPE_CN 一致，presentational 常量）
TYPE_LABELS = {
    "baseline_breach": "基线击穿",
    "date_shift": "日期平移",
    "nearby_airport": "邻近机场",
    "self_transfer": "分开出票",
}


def _parse_date(value, field: str) -> date | None:
    if value in (None, ""):
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError:
        raise SearchInputError(f"{field} 日期格式须为 YYYY-MM-DD")


@dataclass(frozen=True)
class SearchQuery:
    origin: str
    dest: str
    depart_date: date | None
    return_date: date | None
    trip_type: str           # one_way | round_trip
    cabin: str               # ECONOMY | PREMIUM_ECONOMY | BUSINESS | FIRST
    adults: int
    date_mode: str           # exact | flex3 | next7 | next30

    @classmethod
    def parse(cls, data: dict) -> "SearchQuery":
        origin = _code(data.get("origin"), "origin")
        dest = _code(data.get("dest"), "dest")
        if origin == dest:
            raise SearchInputError("origin 与 dest 不能相同")

        trip_type = (data.get("trip_type") or "one_way").strip()
        if trip_type not in VALID_TRIP_TYPES:
            raise SearchInputError(f"trip_type 须为 {VALID_TRIP_TYPES} 之一")

        cabin = (data.get("cabin") or "ECONOMY").strip().upper()
        if cabin not in VALID_CABINS:
            raise SearchInputError(f"cabin 须为 {VALID_CABINS} 之一")

        date_mode = (data.get("date_mode") or "exact").strip()
        if date_mode not in VALID_DATE_MODES:
            raise SearchInputError(f"date_mode 须为 {VALID_DATE_MODES} 之一")

        try:
            adults = int(data.get("adults", 1))
        except (TypeError, ValueError):
            raise SearchInputError("adults 必须为整数")
        if not 1 <= adults <= 9:
            raise SearchInputError("adults 须在 1–9 之间")

        depart_date = _parse_date(data.get("depart_date"), "depart_date")
        return_date = _parse_date(data.get("return_date"), "return_date")

        if date_mode in ("exact", "flex3") and depart_date is None:
            raise SearchInputError("exact/flex3 模式需要 depart_date")
        if trip_type == "round_trip" and return_date is None:
            raise SearchInputError("往返（round_trip）需要 return_date")
        if trip_type == "one_way":
            return_date = None
        if depart_date and return_date and return_date <= depart_date:
            raise SearchInputError("return_date 必须晚于 depart_date")

        return cls(origin, dest, depart_date, return_date, trip_type, cabin, adults, date_mode)

    def cache_key(self) -> str:
        return "|".join([
            self.origin, self.dest,
            self.depart_date.isoformat() if self.depart_date else "-",
            self.return_date.isoformat() if self.return_date else "-",
            self.trip_type, self.cabin, str(self.adults), self.date_mode,
        ])

    def as_dict(self) -> dict:
        return {
            "origin": self.origin, "dest": self.dest,
            "depart_date": self.depart_date.isoformat() if self.depart_date else None,
            "return_date": self.return_date.isoformat() if self.return_date else None,
            "trip_type": self.trip_type, "cabin": self.cabin,
            "adults": self.adults, "date_mode": self.date_mode,
        }


def _code(value, field: str) -> str:
    if not isinstance(value, str):
        raise SearchInputError(f"{field} 缺失")
    v = value.strip().upper()
    if len(v) != 3 or not v.isalpha():
        raise SearchInputError(f"{field} 必须为 3 字母机场码")
    return v
