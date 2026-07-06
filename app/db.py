"""psycopg 3 同步连接池与查询辅助 + 路由加载 + §5.2 关键查询。"""
from dataclasses import dataclass

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import ConnectionPool

from app.settings import settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        if not settings.DATABASE_URL:
            raise RuntimeError("DATABASE_URL 未设置")
        _pool = ConnectionPool(
            settings.DATABASE_URL,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=True,
        )
    return _pool


def query(sql: str, params: dict | tuple | None = None) -> list[dict]:
    with pool().connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params or {})
        return cur.fetchall()


def query_one(sql: str, params: dict | tuple | None = None) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: dict | tuple | None = None) -> None:
    with pool().connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params or {})


def execute_returning(sql: str, params: dict | tuple | None = None) -> dict | None:
    with pool().connection() as conn, conn.cursor() as cur:
        cur.execute(sql, params or {})
        return cur.fetchone()


def executemany(sql: str, seq_params: list[dict] | list[tuple]) -> None:
    rows = list(seq_params)
    if not rows:
        return
    with pool().connection() as conn, conn.cursor() as cur:
        cur.executemany(sql, rows)


# ---------------------------------------------------------------- 路由 -------

@dataclass(frozen=True)
class Route:
    id: str
    origin: str
    dest: str
    trip_type: str
    stay_min: int | None
    stay_max: int | None
    stay_rep: int | None
    tier: str
    nearby_airports: list[str]
    enabled: bool


def _row_to_route(r: dict) -> Route:
    return Route(
        id=r["id"], origin=r["origin"], dest=r["dest"], trip_type=r["trip_type"],
        stay_min=r["stay_min"], stay_max=r["stay_max"], stay_rep=r["stay_rep"],
        tier=r["tier"], nearby_airports=list(r["nearby_airports"] or []),
        enabled=r["enabled"],
    )


def load_enabled_routes() -> list[Route]:
    rows = query("SELECT * FROM route WHERE enabled ORDER BY id")
    return [_row_to_route(r) for r in rows]


def get_route(route_id: str) -> Route | None:
    r = query_one("SELECT * FROM route WHERE id = %(id)s", {"id": route_id})
    return _row_to_route(r) if r else None


def find_route(origin: str, dest: str) -> Route | None:
    r = query_one(
        "SELECT * FROM route WHERE origin = %(o)s AND dest = %(d)s AND enabled LIMIT 1",
        {"o": origin, "d": dest},
    )
    return _row_to_route(r) if r else None


# -------------------------------------------------- §5.2 关键查询（读口径）----

# 最新日历视图：最近 36 小时内每个出发日的最新价（规则层统一读取口径）
LATEST_CALENDAR_SQL = """
SELECT DISTINCT ON (depart_date) id, depart_date, return_date, price
FROM price_snapshot
WHERE route_id = %(rid)s AND is_calendar AND variant IS NULL
  AND currency = %(cur)s AND captured_at > now() - interval '36 hours'
ORDER BY depart_date, captured_at DESC
"""

# 影子航线视图（邻近机场）：同上但指定 variant
LATEST_CALENDAR_SHADOW_SQL = """
SELECT DISTINCT ON (depart_date) id, depart_date, return_date, price
FROM price_snapshot
WHERE route_id = %(rid)s AND is_calendar AND variant = %(v)s
  AND currency = %(cur)s AND captured_at > now() - interval '36 hours'
ORDER BY depart_date, captured_at DESC
"""


def latest_calendar(route_id: str, currency: str, variant: str | None = None) -> list[dict]:
    if variant is None:
        return query(LATEST_CALENDAR_SQL, {"rid": route_id, "cur": currency})
    return query(LATEST_CALENDAR_SHADOW_SQL, {"rid": route_id, "cur": currency, "v": variant})


def jsonb(value) -> Jsonb:
    """把 Python 结构包成 JSONB 适配器（写 route.nearby_airports / opportunity.detail 等）。"""
    return Jsonb(value)
