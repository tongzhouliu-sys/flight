"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { OpportunityCard } from "@/components/opportunity-card";
import { PriceChart } from "@/components/price-chart";
import { ResultsTable } from "@/components/results-table";
import { EmptyState, ErrorState, Loading } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtPrice } from "@/lib/format";
import { useSearchStore } from "@/store/search";

export default function ResultsPage() {
  const router = useRouter();
  const status = useSearchStore((s) => s.status);
  const response = useSearchStore((s) => s.response);
  const error = useSearchStore((s) => s.error);
  const params = useSearchStore((s) => s.params);
  const hydrate = useSearchStore((s) => s.hydrate);
  const runSearch = useSearchStore((s) => s.runSearch);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (status === "loading") return <Loading label="正在实时搜索航班与机会…" />;

  if (status === "error")
    return (
      <ErrorState
        message={error ?? "搜索失败"}
        onRetry={params ? () => runSearch(params) : undefined}
      />
    );

  if (!response)
    return (
      <EmptyState
        title="还没有搜索结果"
        hint="先在搜索页发起一次查询。"
        action={<Button onClick={() => router.push("/")}>去搜索</Button>}
      />
    );

  const { results, opportunities, meta, query } = response;
  const cheapest = results.length
    ? Math.min(...results.map((r) => r.price))
    : null;

  return (
    <div className="flex flex-col gap-6">
      {/* 概览 */}
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {query.origin}→{query.dest}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{query.trip_type === "round_trip" ? "往返" : "单程"}</span>
            <span>·</span>
            <span>{query.cabin}</span>
            <span>·</span>
            <span>{query.adults} 人</span>
            {cheapest != null && (
              <>
                <span>·</span>
                <span>
                  最低{" "}
                  <b className="tnum text-good">
                    {fmtPrice(cheapest, meta.currency)}
                  </b>
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta.provider && <Badge tone="muted">数据源 {meta.provider}</Badge>}
          {meta.monitored_route_id && (
            <Badge tone="info">监控航线 {meta.monitored_route_id}</Badge>
          )}
          {meta.cached && <Badge tone="warn">缓存</Badge>}
          <Badge tone="muted">{meta.point_count} 个采样日</Badge>
          <Button variant="outline" size="sm" onClick={() => router.push("/")}>
            新搜索
          </Button>
        </div>
      </section>

      {/* 推荐机会 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          推荐机会（{opportunities.length}）
        </h2>
        {opportunities.length === 0 ? (
          <EmptyState
            title="未发现明显机会"
            hint="当前窗口内价格无显著优惠，可查看下方原始价格或调整日期灵活度。"
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {opportunities.map((op, i) => (
              <OpportunityCard key={`${op.type}-${i}`} op={op} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* 价格曲线 */}
      {results.length > 1 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            价格曲线
          </h2>
          <div className="rounded-xl border border-border bg-card p-4">
            <PriceChart results={results} currency={meta.currency} />
          </div>
        </section>
      )}

      {/* 原始结果 */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          原始价格（{results.length}）
        </h2>
        <ResultsTable results={results} currency={meta.currency} />
      </section>
    </div>
  );
}
