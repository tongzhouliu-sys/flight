"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EmptyState, Loading } from "@/components/states";
import { ExplainBlock } from "@/components/explain-block";
import { Money } from "@/components/money";
import { PriceLevelBadge } from "@/components/price-level-badge";
import { PriceMeter } from "@/components/price-meter";
import { RecommendationStars } from "@/components/recommendation-stars";
import { RiskBadges } from "@/components/risk-badges";
import { RouteLabel } from "@/components/route-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { RISK_TAG_LABELS, RISK_TAG_TERMS, TYPE_TONE, oppMeta } from "@/lib/constants";
import { fmtPrice, stopsLabel, weekday } from "@/lib/format";
import { formatAirport, airportCity } from "@/lib/airports";
import { levelForOpportunity, readPercentile } from "@/lib/price-level";
import { useSearchStore } from "@/store/search";
import { useCurrencyStore } from "@/lib/currency";

interface OppDetail {
  percentile_now?: number | null;
  window_low?: number | null;
  low_confidence?: boolean;
  p10?: number | null;
  p15?: number | null;
  p50?: number | null;
  carrier?: string | null;
  stops?: number | null;
  trigger?: string;
  best_date?: string;
  center_date?: string;
  variant?: string;
  adder_sgd?: number;
  shadow_price?: number;
}

export default function OpportunityDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const status = useSearchStore((s) => s.status);
  const response = useSearchStore((s) => s.response);
  const hydrate = useSearchStore((s) => s.hydrate);

  // 订阅汇率
  useCurrencyStore((s) => s.rate);

  useEffect(() => {
    hydrate();
    useCurrencyStore.getState().fetchRate();
  }, [hydrate]);

  if (status === "loading" && !response) return <Loading />;

  const index = Number(params.id);
  const op = response?.opportunities?.[index];

  if (!op)
    return (
      <EmptyState
        title="机会不存在或已过期"
        hint="实时搜索结果为临时数据，刷新或过期后需重新搜索。"
        action={<Button onClick={() => router.push("/")}>重新搜索</Button>}
      />
    );

  const d = op.detail as OppDetail;
  const cur = op.currency;
  const meta = oppMeta(op.type, op.type_label);
  const level = levelForOpportunity(readPercentile(op.detail), op.base_price, op.alt_price);

  // 价格标尺区间：窗口最低 → 参考价，标记到手价（仅当有可用区间时展示）
  const meterMin =
    d.window_low != null ? Math.min(d.window_low, op.alt_price) : op.alt_price;
  const meterMax = Math.max(op.base_price, op.alt_price);
  const showMeter = meterMax > meterMin;

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="flex items-center gap-1 self-start text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回结果
      </button>

      {/* 头部 */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Tooltip label={meta.en}>
            <Badge tone={TYPE_TONE[op.type] ?? "muted"}>{meta.zh}</Badge>
          </Tooltip>
          <RouteLabel origin={op.origin} dest={op.dest} size="lg" />
          <p className="text-sm text-muted-foreground">
            出发 {op.depart_date} {weekday(op.depart_date)}
            {op.return_date && ` · 返回 ${op.return_date}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Money
            value={op.alt_price}
            currency={cur}
            className="text-3xl font-bold tracking-tight"
          />
          <p className="tnum text-sm font-medium text-good">
            立省 {fmtPrice(op.saving, cur)}
          </p>
          <div className="flex items-center gap-2">
            <PriceLevelBadge level={level} size="sm" />
            <RecommendationStars count={op.stars} action={op.action} />
          </div>
        </div>
      </section>

      {/* 价格标尺：一眼看贵不贵 */}
      {showMeter && (
        <Card>
          <CardContent className="p-5">
            <PriceMeter
              value={op.alt_price}
              min={meterMin}
              max={meterMax}
              mid={d.p50 ?? null}
              currency={cur}
            />
          </CardContent>
        </Card>
      )}

      {/* 推荐原因 */}
      <ExplainBlock op={op} />

      <div className="grid gap-4 md:grid-cols-2">
        {/* 航班信息 */}
        <Card>
          <CardHeader>
            <CardTitle>航班信息</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="航线" value={`${formatAirport(op.origin)} → ${formatAirport(op.dest)}`} />
            <Field
              label="出发日"
              value={`${op.depart_date ?? "—"} ${weekday(op.depart_date)}`}
            />
            <Field label="返回日" value={op.return_date ?? "单程"} />
            <Field label="航空公司" value={d.carrier ?? "—"} />
            <Field label="中转" value={d.stops == null ? "—" : stopsLabel(d.stops)} />
            {op.layover_cities && op.layover_cities.length > 0 && (
              <>
                <Field
                  label="中转地"
                  value={op.layover_cities.map(code => `${airportCity(code) || code} (${code})`).join(" → ")}
                />
                <Field
                  label="免费托运行李"
                  value={op.free_checked_bag ? "包含免费额度" : "无免费行李额度"}
                  tone={op.free_checked_bag ? "good" : "warn"}
                />
                <Field
                  label="行李是否直挂"
                  value={op.bag_recheck ? "在中转地需重新托运" : "直挂（无需重新托运）"}
                  tone={op.bag_recheck ? "warn" : "good"}
                />
              </>
            )}
            {d.variant && <Field label="替代目的地" value={d.variant} />}
          </CardContent>
        </Card>

        {/* 价格构成 */}
        <Card>
          <CardHeader>
            <CardTitle>价格构成</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="到手价" value={fmtPrice(op.alt_price, cur)} strong />
            <Field label="参考价" value={fmtPrice(op.base_price, cur)} />
            <Field label="立省" value={fmtPrice(op.saving, cur)} tone="good" />
            {op.effective_total != null && (
              <Field
                label="托运折算总价"
                value={fmtPrice(op.effective_total, cur)}
              />
            )}
            {op.baggage_fee != null && (
              <Field label="行李费" value={fmtPrice(op.baggage_fee, cur)} />
            )}
            {d.shadow_price != null && (
              <Field label="邻近机场票价" value={fmtPrice(d.shadow_price, cur)} />
            )}
            {d.adder_sgd != null && (
              <Field label="接驳加价" value={fmtPrice(d.adder_sgd, cur)} />
            )}
          </CardContent>
        </Card>

        {/* 价格水位 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              价格水位
              <PriceLevelBadge level={level} size="sm" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field
              label="当前分位"
              value={d.percentile_now != null ? `P${d.percentile_now}` : "—"}
              hint="百分位越低越便宜（P20 = 比历史 80% 的报价都低）"
            />
            <Field
              label="窗口最低"
              value={d.window_low != null ? fmtPrice(d.window_low, cur) : "—"}
            />
            <Field
              label="历史价位 P10 / P15 / P50"
              value={
                d.p10 != null || d.p15 != null || d.p50 != null
                  ? `${fmtPrice(d.p10 ?? null, cur)} / ${fmtPrice(d.p15 ?? null, cur)} / ${fmtPrice(d.p50 ?? null, cur)}`
                  : "—（实时无历史基线）"
              }
            />
            <Field
              label="参考价样本"
              value={d.low_confidence ? "样本偏少（仅供参考）" : "充足"}
              tone={d.low_confidence ? "warn" : undefined}
            />
          </CardContent>
        </Card>

        {/* 注意事项 */}
        <Card>
          <CardHeader>
            <CardTitle>注意事项</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <RiskBadges tags={op.risk_tags} hardBlock={op.hard_block} />
            {op.risk_tags.length > 0 && (
              <ul className="flex flex-col gap-1.5 text-muted-foreground">
                {op.risk_tags.map((t) => (
                  <li key={t} className="flex items-baseline gap-1.5">
                    <span className="text-muted-foreground">•</span>
                    <span>
                      <b className="text-foreground">
                        {RISK_TAG_LABELS[t] ?? t}
                      </b>
                      <span className="ml-1 text-xs text-muted-foreground/70">
                        {RISK_TAG_TERMS[t] ?? ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <a href={op.deeplink} target="_blank" rel="noopener noreferrer">
          <Button className="gap-1.5">
            打开 Google Flights <ExternalLink className="h-4 w-4" />
          </Button>
        </a>
        <Button variant="outline" onClick={() => router.push("/")}>
          新搜索
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  strong,
  tone,
  hint,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn";
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">
        {label}
        {hint && (
          <Tooltip label={hint}>
            <span className="ml-1 cursor-help text-muted-foreground/60">ⓘ</span>
          </Tooltip>
        )}
      </span>
      <span
        className={[
          "tnum text-right",
          strong ? "text-base font-semibold" : "font-medium",
          tone === "good" ? "text-good" : "",
          tone === "warn" ? "text-warn" : "",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}
