from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol


class ProviderUnavailable(Exception):
    """构造期即不可用（导入失败/无密钥），降级链跳过该 provider。"""


class ProviderError(Exception):
    """单次请求失败，计入失败计数。"""


@dataclass(frozen=True)
class CalendarPoint:
    depart_date: date
    return_date: date | None
    price: float
    currency: str


@dataclass(frozen=True)
class DetailOption:
    price: float
    currency: str
    carrier: str | None          # 二字码；多段取第一段主承运
    stops: int | None
    depart_time: datetime | None
    arrive_time: datetime | None


class CalendarProvider(Protocol):
    name: str
    def calendar(self, origin: str, dest: str, date_from: date, date_to: date,
                 trip_type: str, stay_rep: int | None) -> list[CalendarPoint]: ...


class DetailProvider(Protocol):
    name: str
    def details(self, origin: str, dest: str, depart_date: date,
                return_date: date | None) -> list[DetailOption]: ...
