"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Plane, Utensils, Share2, Compass, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
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
import { formatAirport, airportCity, getAirport } from "@/lib/airports";
import { levelForOpportunity, readPercentile } from "@/lib/price-level";
import { useSearchStore } from "@/store/search";
import { useCurrencyStore } from "@/lib/currency";
import { getFaqAndRemarks, formatDuration, formatDateTime, formatTimeOnly, generateItinerary } from "@/lib/visa-baggage";

const TERMINALS: Record<string, string> = {
  LAX: "TB", MNL: "T1", XMN: "T3", SIN: "T3", PVG: "T2", PEK: "T3", SZX: "T3", CAN: "T2",
  HKG: "T1", TPE: "T2", NRT: "T2", HND: "T3", KIX: "T1", ICN: "T1", BKK: "T1", KUL: "T1",
  DXB: "T3", DOH: "T1", LHR: "T2", CDG: "T2E", FRA: "T1", JFK: "T4", SFO: "TI"
};

function formatAirportWithLang(code: string, isEn: boolean): string {
  const a = getAirport(code);
  if (!a) return code;
  if (isEn) {
    return `${a.cityEn} Airport (${a.code})`;
  } else {
    if (a.name.startsWith(a.city)) {
      return a.name;
    }
    return `${a.city}${a.name}`;
  }
}

function formatDateAndWeekday(isoStr: string, isEn: boolean): { dateLabel: string; weekdayLabel: string } {
  if (!isoStr) return { dateLabel: "", weekdayLabel: "" };
  const dateStr = isoStr.split("T")[0];
  const dateObj = new Date(dateStr);
  const m = dateObj.getMonth();
  const d = dateObj.getDate();
  const w = dateObj.getDay();

  const realMonthsZh = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const weekdaysZh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isEn) {
    return {
      dateLabel: `${monthsEn[m]} ${d}`,
      weekdayLabel: weekdaysEn[w],
    };
  } else {
    return {
      dateLabel: `${realMonthsZh[m]}${d}日`,
      weekdayLabel: weekdaysZh[w],
    };
  }
}

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
  depart_time?: string | null;
  arrive_time?: string | null;
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

  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    try {
      const summaryText = lang === "zh"
        ? `【机票雷达·行程分享】\n航线：${formatAirportWithLang(op.origin, false)} ➔ ${formatAirportWithLang(op.dest, false)}\n出发日：${op.depart_date}\n到手价：${fmtPrice(op.alt_price, cur)}\n立省：${fmtPrice(op.saving, cur)}！`
        : `[FareRadar Itinerary Share]\nRoute: ${formatAirportWithLang(op.origin, true)} ➔ ${formatAirportWithLang(op.dest, true)}\nDeparture: ${op.depart_date}\nPrice: ${fmtPrice(op.alt_price, cur)}\nSavings: ${fmtPrice(op.saving, cur)}!`;
      navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const faqs = getFaqAndRemarks(
    op.origin,
    op.dest,
    op.layover_cities || [],
    op.free_checked_bag,
    op.bag_recheck,
    d.depart_time ?? null,
    d.arrive_time ?? null
  );
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
        <Card className="flex flex-col h-full border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/50">
            <div className="flex flex-col gap-0.5">
              <CardTitle className="text-base font-bold text-foreground">
                {lang === "en" ? "Flight Information" : "航班信息"}
              </CardTitle>
              <p className="text-[10px] text-muted-foreground font-medium">
                {lang === "en" ? "Departure/arrival times are in local time" : "航班起降时间均为当地时间"}
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Language Switcher Toggles */}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setLang("zh")}
                  className={[
                    "px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer",
                    lang === "zh"
                      ? "bg-card text-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground"
                  ].join(" ")}
                >
                  中文
                </button>
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  className={[
                    "px-2.5 py-1 rounded-md font-bold transition-all cursor-pointer",
                    lang === "en"
                      ? "bg-card text-foreground shadow-sm scale-[1.02]"
                      : "text-muted-foreground hover:text-foreground"
                  ].join(" ")}
                >
                  英文
                </button>
              </div>
              
              {/* Share Itinerary Button */}
              <button
                type="button"
                onClick={handleShare}
                className="flex items-center gap-1.5 text-xs font-bold border border-border bg-card hover:bg-muted/50 text-foreground px-2.5 py-1.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-[0.98]"
              >
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <span>{copied ? (lang === "en" ? "Copied!" : "已复制") : (lang === "en" ? "Share" : "行程分享")}</span>
              </button>
            </div>
          </CardHeader>
          
          <CardContent className="pt-4 flex-1 flex flex-col gap-5 overflow-y-auto">
            {/* Itinerary Trip Type & Duration Summary */}
            <div className="flex items-center gap-2 pb-1 text-sm border-b border-border/30 shrink-0">
              <span className="bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wide">
                {op.return_date ? (lang === "en" ? "Round Trip" : "往返") : (lang === "en" ? "One Way" : "单程")}
              </span>
              <span className="font-semibold text-foreground text-xs">
                {op.depart_date && (
                  <span>
                    {lang === "en"
                      ? formatDateAndWeekday(d.depart_time || "", true).dateLabel
                      : formatDateAndWeekday(d.depart_time || "", false).dateLabel
                    }
                    {" "}
                    {lang === "en"
                      ? formatDateAndWeekday(d.depart_time || "", true).weekdayLabel
                      : formatDateAndWeekday(d.depart_time || "", false).weekdayLabel
                    }
                  </span>
                )}
                <span className="mx-2 text-muted-foreground">|</span>
                <span className="text-muted-foreground">
                  {lang === "en" ? "Total duration: " : "总时长 "}
                  <b className="text-foreground">
                    {d.depart_time && d.arrive_time
                      ? formatDuration(d.depart_time, d.arrive_time)
                      : "—"
                    }
                  </b>
                </span>
              </span>
            </div>

            {/* Timeline sectors */}
            <div className="flex flex-col pr-1">
              {generateItinerary(op, lang === "en").map((item, idx) => {
                if (item.type === "flight") {
                  return (
                    <div key={idx} className="flex gap-4">
                      {/* Left: Timings & Dates */}
                      <div className="w-20 shrink-0 text-right flex flex-col justify-between py-1 text-xs">
                        <div>
                          <div className="font-bold text-base text-foreground tracking-tight">{item.departTime}</div>
                          <div className="text-[10px] text-muted-foreground font-semibold">
                            {item.departDate} {item.departWeekday}
                          </div>
                        </div>
                        
                        <div className="my-4 text-[10px] text-muted-foreground/80 font-bold flex flex-col items-end gap-0.5 justify-center flex-1">
                          <span>{item.duration}</span>
                          {item.arriveDateLabel && (
                            <span className="text-warn font-extrabold bg-warn/5 border border-warn/15 px-1.5 py-0.5 rounded mt-0.5 text-[9px]">
                              {item.arriveDateLabel}
                            </span>
                          )}
                        </div>
                        
                        <div>
                          <div className="font-bold text-base text-foreground tracking-tight">{item.arriveTime}</div>
                          {item.arriveDateLabel && (
                            <div className="text-[10px] text-muted-foreground font-semibold">
                              {item.arriveDate}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Line Track */}
                      <div className="flex flex-col items-center py-1.5 shrink-0">
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-primary bg-card z-10 shrink-0 shadow-sm flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        </div>
                        <div className="w-0.5 border-l-2 border-dashed border-border/70 flex-1 my-1.5 min-h-[80px]" />
                        <div className="h-3.5 w-3.5 rounded-full border-2 border-info bg-card z-10 shrink-0 shadow-sm flex items-center justify-center">
                          <div className="h-1.5 w-1.5 rounded-full bg-info" />
                        </div>
                      </div>

                      {/* Right: Airports, details, and cards */}
                      <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                        {/* Departure Airport */}
                        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 truncate">
                          <span className="font-extrabold text-primary shrink-0 text-base">{item.origin}</span>
                          <span className="truncate text-muted-foreground font-medium text-xs">
                            {formatAirportWithLang(item.origin || "", lang === "en")}
                          </span>
                          {item.terminal && (
                            <span className="text-[9px] font-extrabold bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground shrink-0 uppercase">
                              {item.terminal}
                            </span>
                          )}
                        </div>

                        {/* Direct Flight Card */}
                        <div className="my-3 p-3.5 rounded-xl border border-border/80 bg-card/60 hover:bg-muted/10 transition-colors shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2 font-semibold text-foreground">
                            <span className="h-6 w-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <Plane className="h-4 w-4 rotate-45 animate-pulse" />
                            </span>
                            <span className="text-foreground">{item.carrier} <b className="text-primary font-extrabold">{item.flightNumber}</b></span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-muted-foreground font-medium">
                            <span className="px-2 py-0.5 bg-muted/60 border border-border/30 rounded text-[10px]">{item.cabin}</span>
                            {item.aircraft && (
                              <span className="px-2 py-0.5 bg-muted/60 border border-border/30 rounded text-[10px] truncate max-w-[120px]">{item.aircraft}</span>
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-good bg-good/5 border border-good/15 px-2 py-0.5 rounded font-semibold shrink-0">
                              <Utensils className="h-3.5 w-3.5 text-good shrink-0 animate-bounce" />
                              {item.meals}
                            </span>
                          </div>
                        </div>

                        {/* Arrival Airport */}
                        <div className="font-semibold text-sm text-foreground flex items-center gap-1.5 truncate">
                          <span className="font-extrabold text-info shrink-0 text-base">{item.dest}</span>
                          <span className="truncate text-muted-foreground font-medium text-xs">
                            {formatAirportWithLang(item.dest || "", lang === "en")}
                          </span>
                          {TERMINALS[item.dest || ""] && (
                            <span className="text-[9px] font-extrabold bg-muted border border-border px-1.5 py-0.5 rounded text-muted-foreground shrink-0 uppercase">
                              {TERMINALS[item.dest || ""]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else if (item.type === "layover") {
                  return (
                    <div key={idx} className="flex gap-4 my-2">
                      {/* Left Spacer */}
                      <div className="w-20 shrink-0 text-right" />
                      
                      {/* Middle: Timeline track connector */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-0.5 border-l-2 border-dashed border-border/70 flex-1 min-h-[50px]" />
                      </div>
                      
                      {/* Right: Layover card details */}
                      <div className="flex-1 py-1">
                        <div className="bg-muted/40 border border-border/50 rounded-xl p-3.5 flex flex-col gap-2 transition-colors hover:bg-muted/50">
                          <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                            <span className="h-5 w-5 rounded-full bg-info/10 text-info flex items-center justify-center text-[10px] shrink-0 font-extrabold">
                              {lang === "en" ? "T" : "转"}
                            </span>
                            <span>
                              {lang === "en" ? "Layover in" : "中转"} <b className="text-info font-extrabold">{item.city}</b> · {item.layoverDuration}
                            </span>
                          </div>
                          
                          {/* Warnings / Badges */}
                          {item.warnings && item.warnings.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {item.warnings.map((w, wIdx) => {
                                const isWarning = w.includes("提醒") || w.includes("Alert") || w.includes("recheck") || w.includes("非直挂") || w.includes("需");
                                return (
                                  <span
                                    key={wIdx}
                                    className={[
                                      "px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1",
                                      isWarning
                                        ? "bg-bad/5 text-bad border-bad/20"
                                        : "bg-good/5 text-good border-good/20",
                                    ].join(" ")}
                                  >
                                    {isWarning ? (
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                                    )}
                                    <span>{w}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
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

      {/* 常见问题与旅行建议 (备注解答) */}
      <Card>
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="flex flex-wrap items-center gap-2 text-base md:text-lg">
            <span>✈️ 出行解答与签证/行李备注</span>
            <span className="text-xs font-normal text-muted-foreground">（持中国普通护照专属建议）</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 flex flex-col gap-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* 行李相关 */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground border-l-2 border-primary pl-2 mb-1 flex items-center gap-1.5">
                <span>🧳</span> 行李托运解答
              </h3>
              {faqs
                .filter((item) => item.type === "baggage")
                .map((item, idx) => (
                  <div key={idx} className={`rounded-xl p-4 border transition-all ${item.warning ? 'bg-warn/5 border-warn/25' : 'bg-muted/20 border-border/50'}`}>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-start gap-1">
                      <span className="text-primary mt-0.5 font-mono text-xs">Q:</span>
                      <span>{item.q}</span>
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line pl-4">
                      {item.a}
                    </p>
                  </div>
                ))}
            </div>

            {/* 签证相关 */}
            <div className="flex flex-col gap-4">
              <h3 className="text-sm font-bold text-foreground border-l-2 border-info pl-2 mb-1 flex items-center gap-1.5">
                <span>🛂</span> 中国护照签证解答
              </h3>
              {faqs
                .filter((item) => item.type === "visa")
                .map((item, idx) => (
                  <div key={idx} className={`rounded-xl p-4 border transition-all ${item.warning ? 'bg-bad/5 border-bad/20' : 'bg-muted/20 border-border/50'}`}>
                    <h4 className="text-sm font-bold text-foreground mb-2 flex items-start gap-1">
                      <span className="text-info mt-0.5 font-mono text-xs">Q:</span>
                      <span>{item.q}</span>
                    </h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line pl-4 text-justify">
                      {item.a}
                    </p>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
