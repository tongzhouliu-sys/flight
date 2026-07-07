"use client";

import { useEffect, useState } from "react";
import { SearchForm } from "@/components/search-form";
import { api } from "@/lib/api";
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
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">搜索航班机会</h1>
        <p className="text-sm text-muted-foreground">
          实时查询航班价格，并高亮基线击穿、日期平移、邻近机场等低价机会。
        </p>
      </section>

      {routes.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            监控航线快捷填充
          </p>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => pickRoute(r)}
                className="rounded-full border border-border bg-card px-3 py-1 text-sm transition-colors hover:bg-muted"
              >
                {r.origin}→{r.dest}
                <span className="ml-1.5 text-xs text-muted-foreground">
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
