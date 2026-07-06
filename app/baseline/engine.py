"""基线引擎（§8）。

- recompute_self_baselines：执行 §5.2 重算 SQL，逐行 UPSERT 进 baseline(source='self')；
  low_confidence = n < min_sample。桶边界与窗口从 config 注入（不硬编码）。
- derive_coldstart：冷启动派生值（weekly_insights.py 写库时用），纯函数。
- resolve_baseline：读取合并四分支，纯函数（必须单测）。
- lead_bucket：lead_days = depart - today(SGT) 映射到 L0/L1/L2，纯函数。
"""
from dataclasses import dataclass
from datetime import date

from app.db import execute, query, query_one

# §5.2 自建基线重算：桶边界(l0hi/l1hi)、窗口(window)、币种(cur) 全部来自 config
RECOMPUTE_SQL = """
WITH pop AS (
  SELECT route_id,
         to_char(depart_date, 'YYYY-MM') AS travel_month,
         CASE WHEN depart_date - captured_at::date <= %(l0hi)s THEN 'L0'
              WHEN depart_date - captured_at::date <= %(l1hi)s THEN 'L1'
              ELSE 'L2' END AS lead_bucket,
         price
  FROM price_snapshot
  WHERE is_calendar AND variant IS NULL AND currency = %(cur)s
    AND captured_at > now() - make_interval(days => %(window)s)
)
SELECT route_id, travel_month, lead_bucket,
       percentile_cont(0.10) WITHIN GROUP (ORDER BY price) AS p10,
       percentile_cont(0.15) WITHIN GROUP (ORDER BY price) AS p15,
       percentile_cont(0.25) WITHIN GROUP (ORDER BY price) AS p25,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY price) AS p50,
       count(*) AS n
FROM pop
GROUP BY 1, 2, 3
"""

UPSERT_BASELINE = """
INSERT INTO baseline (route_id, travel_month, lead_bucket, p10, p15, p25, p50,
                      sample_n, low_confidence, source, updated_at)
VALUES (%(rid)s, %(tm)s, %(lb)s, %(p10)s, %(p15)s, %(p25)s, %(p50)s,
        %(n)s, %(lc)s, %(src)s, now())
ON CONFLICT (route_id, travel_month, lead_bucket, source) DO UPDATE SET
  p10 = EXCLUDED.p10, p15 = EXCLUDED.p15, p25 = EXCLUDED.p25, p50 = EXCLUDED.p50,
  sample_n = EXCLUDED.sample_n, low_confidence = EXCLUDED.low_confidence, updated_at = now()
"""


@dataclass(frozen=True)
class Baseline:
    route_id: str
    travel_month: str
    lead_bucket: str
    p10: float | None
    p15: float | None
    p25: float | None
    p50: float | None
    sample_n: int
    low_confidence: bool
    source: str


# ------------------------------------------------------------ 纯函数（单测）--

def lead_bucket(depart_date: date, today: date, lead_buckets: dict) -> str:
    """lead_days = depart - today → L0/L1/L2；负数（过去）归 L0。"""
    lead_days = (depart_date - today).days
    if lead_days < 0:
        return "L0"
    for name in ("L0", "L1", "L2"):
        lo, hi = lead_buckets[name]
        if lo <= lead_days <= hi:
            return name
    return "L2"


def derive_coldstart(range_low: float, range_high: float, coldstart_factor: float) -> dict:
    """§8 冷启动派生：p25=low, p50=(low+high)/2, p15=low×factor(0.95), p10=low×0.90。"""
    return {
        "p25": range_low,
        "p50": (range_low + range_high) / 2,
        "p15": range_low * coldstart_factor,
        "p10": range_low * 0.90,
    }


def resolve_baseline(self_row: Baseline | None, cold_row: Baseline | None,
                     min_sample: int) -> Baseline | None:
    """读取合并（§8）：足量自建 > 冷启动 > 不足量自建 > 无。"""
    if self_row and self_row.sample_n >= min_sample:
        return self_row                    # low_confidence=False
    if cold_row:
        return cold_row                    # low_confidence=True
    if self_row:                           # 样本不足但有自建
        return self_row                    # low_confidence=True
    return None                            # 该格无基线 → 不产生 L1 信号


# ------------------------------------------------------------- DB 交互 ------

def recompute_self_baselines(cfg) -> int:
    lb = vars(cfg.baseline.lead_buckets)   # {"L0":[0,13], "L1":[14,56], "L2":[57,9999]}
    rows = query(RECOMPUTE_SQL, {
        "cur": cfg.currency,
        "window": cfg.baseline.window_days,
        "l0hi": lb["L0"][1],
        "l1hi": lb["L1"][1],
    })
    for r in rows:
        low_conf = int(r["n"]) < cfg.baseline.min_sample
        execute(UPSERT_BASELINE, {
            "rid": r["route_id"], "tm": r["travel_month"], "lb": r["lead_bucket"],
            "p10": r["p10"], "p15": r["p15"], "p25": r["p25"], "p50": r["p50"],
            "n": r["n"], "lc": low_conf, "src": "self",
        })
    return len(rows)


def _row_to_baseline(r: dict) -> Baseline:
    return Baseline(
        route_id=r["route_id"], travel_month=r["travel_month"], lead_bucket=r["lead_bucket"],
        p10=_f(r["p10"]), p15=_f(r["p15"]), p25=_f(r["p25"]), p50=_f(r["p50"]),
        sample_n=int(r["sample_n"]), low_confidence=r["low_confidence"], source=r["source"],
    )


def _f(v):
    return float(v) if v is not None else None


def load_baseline_rows(route_id: str, travel_month: str, bucket: str):
    """返回 (self_row, cold_row)。"""
    rows = query(
        "SELECT * FROM baseline WHERE route_id=%(r)s AND travel_month=%(m)s AND lead_bucket=%(b)s",
        {"r": route_id, "m": travel_month, "b": bucket})
    self_row = cold_row = None
    for r in rows:
        b = _row_to_baseline(r)
        if b.source == "self":
            self_row = b
        else:
            cold_row = b
    return self_row, cold_row


def resolve_baseline_db(route_id: str, travel_month: str, bucket: str, min_sample: int) -> Baseline | None:
    self_row, cold_row = load_baseline_rows(route_id, travel_month, bucket)
    return resolve_baseline(self_row, cold_row, min_sample)


GRID_STATS_SQL = """
WITH pop AS (
  SELECT price FROM price_snapshot
  WHERE route_id = %(rid)s AND is_calendar AND variant IS NULL AND currency = %(cur)s
    AND captured_at > now() - make_interval(days => %(window)s)
    AND to_char(depart_date, 'YYYY-MM') = %(month)s
    AND (CASE WHEN depart_date - captured_at::date <= %(l0hi)s THEN 'L0'
              WHEN depart_date - captured_at::date <= %(l1hi)s THEN 'L1'
              ELSE 'L2' END) = %(bucket)s
)
SELECT round(100.0 * count(*) FILTER (WHERE price <= %(price)s) / NULLIF(count(*), 0)) AS pct,
       min(price) AS wlow
FROM pop
"""


def grid_stats(cfg, route_id: str, month: str, bucket: str, price: float) -> dict:
    """当前价在该 (route, month, bucket) 历史样本中的分位 + 窗口最低价（供信号卡）。"""
    lb = vars(cfg.baseline.lead_buckets)
    r = query_one(GRID_STATS_SQL, {
        "rid": route_id, "cur": cfg.currency, "window": cfg.baseline.window_days,
        "month": month, "bucket": bucket, "l0hi": lb["L0"][1], "l1hi": lb["L1"][1],
        "price": price,
    })
    pct = int(r["pct"]) if r and r["pct"] is not None else None
    wlow = float(r["wlow"]) if r and r["wlow"] is not None else None
    return {"pct": pct, "wlow": wlow}
