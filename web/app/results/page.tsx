"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { OpportunityCard } from "@/components/opportunity-card";
import { RouteLabel } from "@/components/route-label";
import { PriceChart } from "@/components/price-chart";
import { ResultsTable } from "@/components/results-table";
import { EmptyState, ErrorState, Loading } from "@/components/states";
import { Money } from "@/components/money";
import { PriceLevelBadge } from "@/components/price-level-badge";
import { RecommendationStars } from "@/components/recommendation-stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CABINS } from "@/lib/constants";
import { fmtPrice } from "@/lib/format";
import { levelForOpportunity, readPercentile } from "@/lib/price-level";
import { useSearchStore } from "@/store/search";
import { useCurrencyStore } from "@/lib/currency";

export default function ResultsPage() {
  const router = useRouter();
  const status = useSearchStore((s) => s.status);
  const response = useSearchStore((s) => s.response);
  const error = useSearchStore((s) => s.error);
  const params = useSearchStore((s) => s.params);
  const hydrate = useSearchStore((s) => s.hydrate);
  const runSearch = useSearchStore((s) => s.runSearch);

  // 订阅汇率以支持响应式更新
  useCurrencyStore((s) => s.rate);

  useEffect(() => {
    hydrate();
    useCurrencyStore.getState().fetchRate();
  }, [hydrate]);

  if (status === "loading") return <Loading label="正在实时搜索航班与省钱机会…" />;

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
  const cur = meta.currency;
  const prices = results.map((r) => r.price);
  const cheapest = prices.length ? Math.min(...prices) : null;
  const highest = prices.length ? Math.max(...prices) : null;
  const cabinLabel =
    CABINS.find((c) => c.value === query.cabin)?.label ?? query.cabin;

  const top = opportunities[0]; // 已按 saving 倒序
  const topLevel = top
    ? levelForOpportunity(readPercentile(top.detail), top.base_price, top.alt_price)
    : null;

  return (
    <div className="flex flex-col md:grid md:grid-cols-12 gap-6 items-start">
      {/* 左侧栏：汇总信息、快速结论、省钱机会 */}
      <div className="flex flex-col gap-5 md:col-span-5 w-full">
        {/* 头部航线概要 */}
        <section className="flex items-center justify-between gap-2 p-1 shrink-0">
          <div>
            <RouteLabel origin={query.origin} dest={query.dest} size="lg" />
            <p className="mt-0.5 text-xs text-muted-foreground">
              {cabinLabel} · {query.trip_type === "round_trip" ? "往返" : "单程"}{" "}
              · {query.adults} 人 · 采样 {meta.point_count} 天
              {meta.cached && " · 缓存"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground border border-border bg-card px-2.5 py-1.5 rounded-lg shadow-sm hover:bg-muted cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 新搜索
          </button>
        </section>

        {/* 快速结论：5 秒回答三问 */}
        <Card className="overflow-hidden border-primary/10 shadow-sm shrink-0">
          <CardContent className="grid gap-4 p-4 grid-cols-3 divide-x divide-border/80 bg-gradient-to-br from-card via-card to-primary/5">
            <Verdict
              q="现在买贵不贵？"
              main={
                cheapest != null ? (
                  <Money
                    value={cheapest}
                    currency={cur}
                    className="text-lg font-bold tracking-tight"
                  />
                ) : (
                  "—"
                )
              }
              extra={
                topLevel ? (
                  <PriceLevelBadge level={topLevel} size="sm" />
                ) : cheapest != null && highest != null && highest > cheapest ? (
                  <span className="text-[10px] text-muted-foreground truncate">
                    区间 {fmtPrice(cheapest, cur)} – {fmtPrice(highest, cur)}
                  </span>
                ) : null
              }
            />
            <Verdict
              q="有没有更便宜？"
              className="pl-3"
              main={
                top ? (
                  <span className="tnum text-lg font-bold tracking-tight text-good">
                    省 {fmtPrice(top.saving, cur)}
                  </span>
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    暂未发现
                  </span>
                )
              }
              extra={
                <span className="text-[10px] text-muted-foreground truncate">
                  {opportunities.length > 0
                    ? `共 ${opportunities.length} 个省钱机会`
                    : "当前窗口较平稳"}
                </span>
              }
            />
            <Verdict
              q="推荐买吗？"
              className="pl-3"
              main={
                top ? (
                  <RecommendationStars count={top.stars} action={top.action} />
                ) : (
                  <span className="text-sm font-medium text-muted-foreground">
                    继续关注
                  </span>
                )
              }
              extra={
                <span className="text-[10px] text-muted-foreground truncate">
                  {top ? "基于历史与风险" : "暂无明显买点"}
                </span>
              }
            />
          </CardContent>
        </Card>

        {/* 省钱机会 */}
        <section className="flex flex-col gap-2">
          <SectionTitle icon={<Sparkles className="h-4 w-4" />}>
            省钱机会（{opportunities.length}）
          </SectionTitle>
          <div className="flex flex-col gap-3">
            {opportunities.length === 0 ? (
              <div className="flex items-center justify-center p-6 border border-dashed rounded-xl bg-muted/10 text-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">未发现明显省钱机会</p>
                  <p className="mt-1 text-xs text-muted-foreground/60 max-w-xs">当前窗口内价格无显著优惠，可查看右侧全部价格。</p>
                </div>
              </div>
            ) : (
              <div className="grid items-stretch gap-3 grid-cols-1">
                {opportunities.map((op, i) => (
                  <OpportunityCard key={`${op.type}-${i}`} op={op} index={i} />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 右侧栏：价格趋势、全部日期表格 */}
      <div className="flex flex-col gap-5 md:col-span-7 w-full">
        {/* 价格趋势 */}
        {results.length > 1 && (
          <section className="shrink-0 flex flex-col gap-2">
            <SectionTitle>价格趋势</SectionTitle>
            <Card className="shadow-sm">
              <CardContent className="p-3">
                <div className="h-40 md:h-44 relative">
                  <PriceChart results={results} currency={cur} />
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        {/* 全部日期价格 */}
        <section className="flex flex-col gap-2">
          <SectionTitle>全部日期价格（{results.length}）</SectionTitle>
          <div>
            <ResultsTable results={results} currency={cur} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Verdict({
  q,
  main,
  extra,
  className,
}: {
  q: string;
  main: React.ReactNode;
  extra?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <p className="text-xs font-medium text-muted-foreground">{q}</p>
      <div className="flex min-h-9 items-center">{main}</div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}

function SectionTitle({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
      {icon}
      {children}
    </h2>
  );
}
