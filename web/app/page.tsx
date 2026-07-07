"use client";

import { useEffect, useState } from "react";
import { MapPin, Sparkles, Star, TrendingDown } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { api } from "@/lib/api";
import { airportCity } from "@/lib/airports";
import { useSearchStore } from "@/store/search";
import type { RouteInfo, SearchParams } from "@/types";

export default function Home() {
  const replay = useSearchStore((s) => s.replay);
  const setReplay = useSearchStore((s) => s.setReplay);

  // 同步捕获一次 replay，确保表单首次挂载即带入历史条件
  const [seed, setSeed] = useState<Partial<SearchParams> | null>(() => replay);
  const [autoSubmit, setAutoSubmit] = useState<boolean>(() => !!replay);
  const [formKey, setFormKey] = useState(0);
  const [routes, setRoutes] = useState<RouteInfo[]>([]);

  useEffect(() => {
    if (replay) setReplay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .routes()
      .then((r) => alive && setRoutes(r.routes))
      .catch(() => {
        /* 后端不可用时静默：快捷航线只是便利功能 */
      });
    return () => {
      alive = false;
    };
  }, []);

  function pickRoute(r: RouteInfo) {
    setSeed({ origin: r.origin, dest: r.dest, trip_type: r.trip_type });
    setAutoSubmit(false);
    setFormKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          5 秒看懂机票贵不贵
        </h1>
        <p className="text-sm text-muted-foreground">
          实时查询航班价格，自动高亮更便宜的方案，并给出「买不买」的建议。
        </p>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-good" />
            现在买贵不贵
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-info" />
            有没有更便宜的方案
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-warn" />
            推荐买吗
          </span>
        </div>
      </section>

      {routes.length > 0 && (
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> 监控航线快捷填充
          </p>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRoute(r)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm transition-colors hover:border-primary/30 hover:bg-muted"
              >
                <span className="font-medium">
                  {r.origin}
                  {airportCity(r.origin) && (
                    <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                      {airportCity(r.origin)}
                    </span>
                  )}
                  {" → "}
                  {r.dest}
                  {airportCity(r.dest) && (
                    <span className="ml-0.5 font-normal text-muted-foreground text-xs">
                      {airportCity(r.dest)}
                    </span>
                  )}
                </span>
                <span className="rounded bg-muted px-1.5 py-px text-[11px] text-muted-foreground">
                  {r.tier}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <SearchForm key={formKey} initial={seed} autoSubmit={autoSubmit} />
    </div>
  );
}
