"""应用 db/schema.sql（幂等）并从 config/routes.yaml upsert route 表。

用法：`python scripts/bootstrap_db.py`（连续执行两次均应成功）。
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import jsonb, pool
from app.settings import ROOT, load_routes_yaml

UPSERT_ROUTE = """
INSERT INTO route (id, origin, dest, trip_type, stay_min, stay_max, stay_rep,
                   tier, nearby_airports, enabled)
VALUES (%(id)s, %(origin)s, %(dest)s, %(trip_type)s, %(stay_min)s, %(stay_max)s,
        %(stay_rep)s, %(tier)s, %(nearby)s, %(enabled)s)
ON CONFLICT (id) DO UPDATE SET
  origin = EXCLUDED.origin, dest = EXCLUDED.dest, trip_type = EXCLUDED.trip_type,
  stay_min = EXCLUDED.stay_min, stay_max = EXCLUDED.stay_max, stay_rep = EXCLUDED.stay_rep,
  tier = EXCLUDED.tier, nearby_airports = EXCLUDED.nearby_airports, enabled = EXCLUDED.enabled
"""


def main() -> None:
    schema_sql = (ROOT / "db" / "schema.sql").read_text(encoding="utf-8")
    routes = load_routes_yaml()
    with pool().connection() as conn, conn.cursor() as cur:
        cur.execute(schema_sql)
        for r in routes:
            cur.execute(UPSERT_ROUTE, {
                "id": r["id"], "origin": r["origin"], "dest": r["dest"],
                "trip_type": r["trip_type"], "stay_min": r.get("stay_min"),
                "stay_max": r.get("stay_max"), "stay_rep": r.get("stay_rep"),
                "tier": r["tier"], "nearby": jsonb(r.get("nearby_airports", [])),
                "enabled": r["enabled"],
            })
    print(f"bootstrap done: schema applied, {len(routes)} routes upserted")


if __name__ == "__main__":
    main()
