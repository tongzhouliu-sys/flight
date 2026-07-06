"""联网冒烟（手动运行）：验证三源可用性 + 降级链 + provider_usage 计数。

顺序：fli 日历扫 R1（≥30 点）→ fli 详情 R1 → fast-flights 详情对照 →
      SerpAPI price_insights → 降级链（provider_usage 递增；强制 fli 失效观察降级）。
任一步失败打印异常但继续，末尾汇总。
用法：`python scripts/smoke_providers.py`
"""
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.settings import load_config  # noqa: E402

O, D = "SIN", "WUH"
DEP = date.today() + timedelta(days=30)
FROM = date.today() + timedelta(days=1)
TO = date.today() + timedelta(days=60)

results = {}


def step(name, fn):
    print(f"\n=== {name} ===")
    try:
        fn()
        results[name] = "OK"
    except Exception as e:
        results[name] = f"FAIL {type(e).__name__}: {e}"
        print("  ", results[name])


def main():
    cfg = load_config()

    def fli_calendar():
        from app.providers.fli_provider import FliProvider
        p = FliProvider(cfg.currency, cfg.cabin, cfg.pax)
        pts = p.calendar(O, D, FROM, TO, "one_way", None)
        print(f"  fli calendar points: {len(pts)} (期望 ≥30)")
        for c in pts[:5]:
            print("   ", c.depart_date, c.price, c.currency)
        assert len(pts) >= 30, "少于 30 个日历点"

    def fli_details():
        from app.providers.fli_provider import FliProvider
        p = FliProvider(cfg.currency, cfg.cabin, cfg.pax)
        opts = p.details(O, D, DEP, None)
        print(f"  fli details: {len(opts)} 条，前 5：")
        for o in opts[:5]:
            print("   ", o.price, o.currency, o.carrier, "stops=", o.stops, o.depart_time, "->", o.arrive_time)

    def ff_details():
        from app.providers.fastflights_provider import FastFlightsProvider
        p = FastFlightsProvider(cfg.currency, cfg.cabin, cfg.pax)
        opts = p.details(O, D, DEP, None)
        print(f"  fast-flights details: {len(opts)} 条，前 5：")
        for o in opts[:5]:
            print("   ", o.price, o.currency, o.carrier, "stops=", o.stops)

    def serpapi_insights():
        from app.providers.serpapi_provider import SerpApiProvider
        p = SerpApiProvider(cfg.currency, cfg.cabin, cfg.pax)
        pi = p.price_insights(O, D, DEP)
        print("  price_insights:", pi.get("range_low"), "-", pi.get("range_high"))

    def chain_and_degrade():
        from app.providers.chain import ProviderChain
        ch = ProviderChain(cfg)
        pts = ch.calendar(O, D, FROM, TO, "one_way", None)
        print(f"  chain.calendar 正常：{len(pts)} 点；usage(fli)={_usage('fli')}")
        # 强制 fli 降级，观察切换到 fast_flights
        ch._degraded.add("fli")
        pts2 = ch.calendar(O, D, FROM, min(FROM + timedelta(days=10), TO), "one_way", None)
        print(f"  强制 fli 降级后 chain.calendar：{len(pts2)} 点（应由 fast_flights 提供）；"
              f"usage(fast_flights)={_usage('fast_flights')}")
        ch.flush_ops_log()

    def _usage(p):
        from app.db import query_one
        r = query_one("SELECT COALESCE(used,0) u FROM provider_usage WHERE provider=%(p)s AND day=CURRENT_DATE", {"p": p})
        return r["u"] if r else 0

    step("1. fli 日历扫 R1", fli_calendar)
    step("2. fli 详情 R1", fli_details)
    step("3. fast-flights 详情对照", ff_details)
    step("4. SerpAPI price_insights", serpapi_insights)
    step("5. 降级链 + provider_usage", chain_and_degrade)

    print("\n===== 汇总 =====")
    for k, v in results.items():
        print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
