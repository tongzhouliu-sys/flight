"use client";

import { useEffect, useState } from "react";
import { MapPin, Sparkles, Star, TrendingDown } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { api } from "@/lib/api";
import { airportCity } from "@/lib/airports";
import { useSearchStore } from "@/store/search";
import { useCurrencyStore } from "@/lib/currency";
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
    useCurrencyStore.getState().fetchRate();
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
    <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:h-full md:items-stretch overflow-hidden">
      {/* 左侧栏：宣传与快捷链接 */}
      <div className="flex flex-col gap-5 md:col-span-5 md:justify-center md:h-full">
        {/* Premium Hero Section */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-md">
          {/* Decorative background glow */}
          <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-primary/10 blur-3xl animate-glow" />
          <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-info/10 blur-3xl animate-glow" />

          <div className="relative flex flex-col gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
              5 秒看懂机票贵不贵
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              实时查询航班价格，自动高亮更便宜的方案，智能给出「买不买」的决策推荐。
            </p>
            <div className="mt-2 flex flex-col gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-good/10 px-3 py-1 text-good w-fit">
                <TrendingDown className="h-3.5 w-3.5" />
                现在买贵不贵？
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1 text-info w-fit">
                <Sparkles className="h-3.5 w-3.5" />
                有没有更便宜的方案？
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-3 py-1 text-warn w-fit">
                <Star className="h-3.5 w-3.5" />
                推荐买吗？
              </span>
            </div>
          </div>
        </section>

        {routes.length > 0 && (
          <section className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
              <MapPin className="h-3.5 w-3.5 text-primary" /> 监控航线快捷填充
            </p>
            <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[160px] md:max-h-[220px] pr-1 thin-scroll">
              {routes.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => pickRoute(r)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs transition-colors hover:border-primary/30 hover:bg-muted cursor-pointer"
                >
                  <span className="font-medium">
                    {r.origin}
                    {airportCity(r.origin) && (
                      <span className="ml-0.5 font-normal text-muted-foreground text-[10px]">
                        {airportCity(r.origin)}
                      </span>
                    )}
                    {" → "}
                    {r.dest}
                    {airportCity(r.dest) && (
                      <span className="ml-0.5 font-normal text-muted-foreground text-[10px]">
                        {airportCity(r.dest)}
                      </span>
                    )}
                  </span>
                  <span className="rounded bg-muted px-1 py-px text-[9px] text-muted-foreground scale-90">
                    {r.tier}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 右侧栏：搜索表单 */}
      <div className="md:col-span-7 md:h-full md:overflow-y-auto pr-1 thin-scroll flex flex-col justify-center">
        <SearchForm key={formKey} initial={seed} autoSubmit={autoSubmit} />
      </div>
    </div>
  );
}
