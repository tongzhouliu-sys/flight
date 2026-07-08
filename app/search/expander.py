"""Route Expander：请求 → 日期窗口 + 往返时长 + 邻近机场候选 + 是否监控航线。

- 日期窗口：exact=当日；flex3=中心±3；next7/next30/next60=今天起 N 天。
- 邻近机场候选：由 config/routes.yaml 的 nearby_airports 归纳（dest → 替代目的地）。
- 命中 8 条监控航线之一 → 记录 route_id（决定 baseline 走 DB 还是冷启动）。
"""
from dataclasses import dataclass
from datetime import date, timedelta

from app.db import find_route
from app.settings import load_routes_yaml, today_sgt
from app.search.models import SearchQuery


@dataclass(frozen=True)
class ExpandedPlan:
    origin: str
    dest: str
    date_from: date
    date_to: date
    center_date: date | None
    trip_type: str
    stay_rep: int | None
    nearby_variants: list[str]
    monitored_route_id: str | None


def _nearby_map() -> dict[str, list[str]]:
    """dest 机场 → 邻近替代目的地列表（来自 routes.yaml）。"""
    out: dict[str, list[str]] = {}
    for r in load_routes_yaml():
        near = r.get("nearby_airports")
        if not near:
            continue
        bucket = out.setdefault(r["dest"], [])
        for v in near:
            if v not in bucket:
                bucket.append(v)
    return out


def expand(q: SearchQuery) -> ExpandedPlan:
    today = today_sgt()

    if q.date_mode == "exact":
        date_from = date_to = q.depart_date
        center = q.depart_date
    elif q.date_mode == "flex3":
        date_from = max(q.depart_date - timedelta(days=3), today)
        date_to = q.depart_date + timedelta(days=3)
        center = q.depart_date
    elif q.date_mode == "next7":
        date_from, date_to, center = today, today + timedelta(days=7), None
    elif q.date_mode == "next30":
        date_from, date_to, center = today, today + timedelta(days=30), None
    else:  # next60
        date_from, date_to, center = today, today + timedelta(days=60), None

    stay_rep = None
    if q.trip_type == "round_trip":
        stay_rep = (q.return_date - q.depart_date).days if (q.depart_date and q.return_date) else 10

    route = find_route(q.origin, q.dest)
    monitored = route.id if route else None
    variants = _nearby_map().get(q.dest, [])

    return ExpandedPlan(
        origin=q.origin, dest=q.dest,
        date_from=date_from, date_to=date_to, center_date=center,
        trip_type=q.trip_type, stay_rep=stay_rep,
        nearby_variants=list(variants), monitored_route_id=monitored,
    )
