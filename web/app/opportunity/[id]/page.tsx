"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { EmptyState, Loading } from "@/components/states";
import { RecommendationStars } from "@/components/recommendation-stars";
import { RiskBadges } from "@/components/risk-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RISK_TAG_LABELS, TYPE_TONE } from "@/lib/constants";
import { fmtPrice, stopsLabel, weekday } from "@/lib/format";
import { useSearchStore } from "@/store/search";

const RULE_NAME: Record<string, string> = {
  baseline_breach: "BaselineBreach",
  date_shift: "DateShiftRule",
  nearby_airport: "NearbyAirportRule",
  self_transfer: "SelfTransferRule",
};

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

  useEffect(() => {
    hydrate();
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

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← 返回结果
      </button>

      {/* 头部 */}
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Badge tone={TYPE_TONE[op.type] ?? "muted"}>{op.type_label}</Badge>
          <h1 className="text-2xl font-semibold">
            {op.origin}→{op.dest}
          </h1>
          <p className="text-sm text-muted-foreground">
            出发 {op.depart_date} {weekday(op.depart_date)}
            {op.return_date && ` · 返回 ${op.return_date}`}
          </p>
        </div>
        <div className="text-right">
          <p className="tnum text-3xl font-bold">
            {fmtPrice(op.alt_price, cur)}
          </p>
          <p className="tnum text-sm font-medium text-good">
            省 {fmtPrice(op.saving, cur)}
          </p>
          <div className="mt-2 flex justify-end">
            <RecommendationStars count={op.stars} action={op.action} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 航班信息 */}
        <Card>
          <CardHeader>
            <CardTitle>航班信息</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="航线" value={`${op.origin} → ${op.dest}`} />
            <Field
              label="出发日"
              value={`${op.depart_date ?? "—"} ${weekday(op.depart_date)}`}
            />
            <Field label="返回日" value={op.return_date ?? "单程"} />
            <Field label="承运" value={d.carrier ?? "—"} />
            <Field
              label="经停"
              value={d.stops == null ? "—" : stopsLabel(d.stops)}
            />
            {d.variant && <Field label="替代目的地" value={d.variant} />}
          </CardContent>
        </Card>

        {/* 价格构成 */}
        <Card>
          <CardHeader>
            <CardTitle>价格构成</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="成交价" value={fmtPrice(op.alt_price, cur)} strong />
            <Field label="参考价" value={fmtPrice(op.base_price, cur)} />
            <Field label="节省" value={fmtPrice(op.saving, cur)} tone="good" />
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
              <Field label="影子航线价" value={fmtPrice(d.shadow_price, cur)} />
            )}
            {d.adder_sgd != null && (
              <Field label="接驳加价" value={fmtPrice(d.adder_sgd, cur)} />
            )}
            <Field label="币种" value={cur} />
          </CardContent>
        </Card>

        {/* 基线水位 */}
        <Card>
          <CardHeader>
            <CardTitle>基线水位</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field
              label="当前分位"
              value={d.percentile_now != null ? `P${d.percentile_now}` : "—"}
            />
            <Field
              label="窗口最低"
              value={d.window_low != null ? fmtPrice(d.window_low, cur) : "—"}
            />
            <Field
              label="P10 / P15 / P50"
              value={
                d.p10 != null || d.p15 != null || d.p50 != null
                  ? `${fmtPrice(d.p10 ?? null, cur)} / ${fmtPrice(d.p15 ?? null, cur)} / ${fmtPrice(d.p50 ?? null, cur)}`
                  : "—（实时无历史基线）"
              }
            />
            <Field
              label="基线置信度"
              value={d.low_confidence ? "低置信度" : "正常"}
              tone={d.low_confidence ? "warn" : undefined}
            />
          </CardContent>
        </Card>

        {/* 触发规则 */}
        <Card>
          <CardHeader>
            <CardTitle>触发规则</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Field label="规则" value={RULE_NAME[op.type] ?? op.type} />
            <Field label="触发条件" value={d.trigger ?? "—"} />
            {d.center_date && <Field label="中心日期" value={d.center_date} />}
            {d.best_date && <Field label="最优日期" value={d.best_date} />}
          </CardContent>
        </Card>
      </div>

      {/* 风险 */}
      <Card>
        <CardHeader>
          <CardTitle>风险说明</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <RiskBadges tags={op.risk_tags} hardBlock={op.hard_block} />
          {op.risk_tags.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-muted-foreground">
              {op.risk_tags.map((t) => (
                <li key={t}>
                  • <b className="text-foreground">{RISK_TAG_LABELS[t] ?? t}</b>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* 推荐 + 预留评分 */}
      <Card>
        <CardHeader>
          <CardTitle>推荐原因</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center gap-3">
            <RecommendationStars count={op.stars} action={op.action} />
          </div>
          <p className="text-muted-foreground">{op.explain.text}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3">
            <Field
              label="风险评分（预留）"
              value={op.risk_score != null ? String(op.risk_score) : "待定"}
            />
            <Field
              label="推荐评分（预留）"
              value={
                op.recommendation_score != null
                  ? String(op.recommendation_score)
                  : "待定"
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            数值评分模型尚未在后端定义，字段已预留；当前以真实标签与 1–4★
            建议档展示。
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <a href={op.deeplink} target="_blank" rel="noopener noreferrer">
          <Button>打开 Google Flights</Button>
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
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "good" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
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
