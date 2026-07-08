"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, SlidersHorizontal, ChevronDown, ChevronUp, X, Filter, Plane, AlertTriangle, Loader2 } from "lucide-react";
import { OpportunityCard } from "@/components/opportunity-card";
import { getAirport } from "@/lib/airports";
import { generateItinerary } from "@/lib/visa-baggage";
import type { Opportunity } from "@/types";

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
import { RouteLabel } from "@/components/route-label";
import { PriceChart } from "@/components/price-chart";
import { PriceCalendar } from "@/components/price-calendar";
import { EmptyState, ErrorState, Loading } from "@/components/states";
import { Money } from "@/components/money";
import { PriceLevelBadge } from "@/components/price-level-badge";
import { RecommendationStars } from "@/components/recommendation-stars";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CABINS } from "@/lib/constants";
import { fmtPrice } from "@/lib/format";
import { levelForOpportunity, readPercentile } from "@/lib/price-level";
import { useSearchStore } from "@/store/search";
import { useCurrencyStore } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { airportCity } from "@/lib/airports";

export default function ResultsPage() {
  const router = useRouter();
  const status = useSearchStore((s) => s.status);
  const response = useSearchStore((s) => s.response);
  const error = useSearchStore((s) => s.error);
  const params = useSearchStore((s) => s.params);
  const hydrate = useSearchStore((s) => s.hydrate);
  const runSearch = useSearchStore((s) => s.runSearch);

  const filters = useSearchStore((s) => s.filters);
  const updateFilters = useSearchStore((s) => s.updateFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // 订阅汇率以支持响应式更新
  useCurrencyStore((s) => s.rate);

  // 汇率或优惠前税费过滤
  const TAX_SGD = 70;
  const TAX_CNY = 350;

  const adjustPrice = useCallback((price: number, currency: string) => {
    let tax = 0;
    if (filters.excludeTax) {
      tax += currency === "SGD" ? TAX_SGD : TAX_CNY;
    }
    if (filters.studentTicket) {
      return (price - tax) * 0.95;
    }
    return price - tax;
  }, [filters.excludeTax, filters.studentTicket]);

  // 选中的日期与详情状态
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateDetail, setSelectedDateDetail] = useState<Opportunity | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    useCurrencyStore.getState().fetchRate();
  }, [hydrate]);

  // 默认选中最低价格的日期
  useEffect(() => {
    if (!response) return;
    const results = response.results;
    if (!results || results.length === 0) return;
    
    const prices = results.map(r => adjustPrice(r.price, r.currency));
    const minPrice = prices.length ? Math.min(...prices) : 0;
    const cheapestRes = results.find(r => adjustPrice(r.price, r.currency) === minPrice);
    const targetDate = cheapestRes ? cheapestRes.depart_date : results[0].depart_date;

    if (selectedDate !== targetDate) {
      Promise.resolve().then(() => {
        setSelectedDate(targetDate);
      });
    }
  }, [response, selectedDate, adjustPrice]);

  // 监听选中日期变化，实时请求航班详情
  useEffect(() => {
    if (!selectedDate || !response) return;

    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setDetailLoading(true);
        setDetailError(null);
      }
    });

    const query = response.query;
    const matchedRes = response.results.find((r) => r.depart_date === selectedDate);
    const returnDate = query.trip_type === "round_trip" ? matchedRes?.return_date || query.return_date : null;

    fetch("/api/search/detail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: query.origin,
        dest: query.dest,
        depart_date: selectedDate,
        return_date: returnDate,
        cabin: query.cabin,
        adults: query.adults,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("获取详情失败");
        return res.json();
      })
      .then((data) => {
        if (active) {
          setSelectedDateDetail(data.option);
        }
      })
      .catch((err) => {
        if (active) {
          setDetailError(err.message || "加载失败");
        }
      })
      .finally(() => {
        if (active) {
          setDetailLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedDate, response]);

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
  const cabinLabel =
    CABINS.find((c) => c.value === query.cabin)?.label ?? query.cabin;

  // 动态获取航空公司与中转城市供筛选
  const allAirlines = Array.from(
    new Set(opportunities.map((op) => (op.detail?.carrier as string || "").toUpperCase()))
  ).filter(Boolean);

  const allLayoverCities = Array.from(
    new Set(opportunities.flatMap((op) => op.layover_cities || []))
  ).map((c) => c.toUpperCase());

  // adjustPrice defined at the top of the component

  // 筛选 opportunities
  const filteredOpportunities = opportunities.filter((op) => {
    const carrier = (op.detail?.carrier as string || "").toUpperCase();
    const stops = (op.detail?.stops as number | undefined) ?? op.layover_cities?.length ?? 0;

    if (filters.directOnly && stops > 0) return false;
    if (filters.hasBaggage && !op.free_checked_bag) return false;
    if (
      filters.noTransitVisa &&
      (op.bag_recheck || op.risk_tags.includes("border_crossing") || op.type === "self_transfer")
    )
      return false;
    if (filters.excludeCodeshare && op.risk_tags.includes("codeshare")) return false;

    // 联盟
    if (filters.alliances.length > 0) {
      const star = ["SQ", "CA", "BR", "ZH", "UA", "LH", "NH", "NZ", "TG"];
      const skyteam = ["MU", "CZ", "MF", "CI", "DL", "AF", "KL", "KE", "VN"];
      const oneworld = ["CX", "JL", "AA", "BA", "QR", "AY", "MH"];
      let matchAlliance = false;
      if (filters.alliances.includes("star") && star.includes(carrier)) matchAlliance = true;
      if (filters.alliances.includes("skyteam") && skyteam.includes(carrier)) matchAlliance = true;
      if (filters.alliances.includes("oneworld") && oneworld.includes(carrier)) matchAlliance = true;
      if (!matchAlliance) return false;
    }

    if (filters.airlines.length > 0 && !filters.airlines.includes(carrier)) return false;

    // 中转次数
    if (filters.transitCount.length > 0) {
      const has1 = filters.transitCount.includes("1") && stops === 1;
      const has2 = filters.transitCount.includes("2+") && stops >= 2;
      if (!has1 && !has2) return false;
    }

    // 中转城市
    if (filters.transitCities.length > 0) {
      const cities = (op.layover_cities || []).map((c) => c.toUpperCase());
      const matchCity = cities.some((c) => filters.transitCities.includes(c));
      if (!matchCity) return false;
    }

    // 机型
    if (filters.aircraftTypes.length > 0) {
      const aircraft = (op.detail?.aircraft as string || "Boeing 777").toLowerCase();
      const isLarge =
        aircraft.includes("777") ||
        aircraft.includes("787") ||
        aircraft.includes("747") ||
        aircraft.includes("350") ||
        aircraft.includes("380") ||
        aircraft.includes("大型");
      if (filters.aircraftTypes.includes("large") && !isLarge) return false;
    }

    // 时长限制
    const depDate = op.detail?.depart_time ? new Date(op.detail.depart_time as string) : null;
    const arrDate = op.detail?.arrive_time ? new Date(op.detail.arrive_time as string) : null;
    const totalMinutes =
      depDate && arrDate ? Math.round((arrDate.getTime() - depDate.getTime()) / 60000) : 0;
    const transitMinutes = stops === 0 ? 0 : stops === 1 ? (totalMinutes >= 300 ? 100 : 65) : stops * 100;

    if (filters.maxTransitDuration < 28 && transitMinutes / 60 > filters.maxTransitDuration)
      return false;
    if (filters.maxTotalDuration < 36 && totalMinutes / 60 > filters.maxTotalDuration) return false;

    return true;
  });

  // 筛选 results
  const filteredResults = results.filter((r) => {
    if (r.stops != null) {
      if (filters.directOnly && r.stops > 0) return false;
      if (filters.transitCount.length > 0) {
        const has1 = filters.transitCount.includes("1") && r.stops === 1;
        const has2 = filters.transitCount.includes("2+") && r.stops >= 2;
        if (!has1 && !has2) return false;
      }
    }
    if (r.carrier != null && filters.airlines.length > 0) {
      if (!filters.airlines.includes(r.carrier.toUpperCase())) return false;
    }
    return true;
  });

  // 应用价格修改
  const displayResults = filteredResults.map((r) => ({
    ...r,
    price: adjustPrice(r.price, r.currency),
  }));

  const displayOpportunities = filteredOpportunities.map((op) => {
    const base = adjustPrice(op.base_price, op.currency);
    const alt = adjustPrice(op.alt_price, op.currency);
    return {
      ...op,
      base_price: base,
      alt_price: alt,
      saving: base - alt,
    };
  });

  const displayPrices = displayResults.map((r) => r.price);
  const cheapest = displayPrices.length ? Math.min(...displayPrices) : null;
  const highest = displayPrices.length ? Math.max(...displayPrices) : null;

  const top = displayOpportunities[0]; // 已按 saving 倒序
  const topLevel = top
    ? levelForOpportunity(readPercentile(top.detail), top.base_price, top.alt_price)
    : null;

  // 标签与重置判定
  const toggleAlliance = (alliance: string) => {
    const list = filters.alliances.includes(alliance)
      ? filters.alliances.filter((a) => a !== alliance)
      : [...filters.alliances, alliance];
    updateFilters({ alliances: list });
  };

  const toggleAirline = (airline: string) => {
    const list = filters.airlines.includes(airline)
      ? filters.airlines.filter((a) => a !== airline)
      : [...filters.airlines, airline];
    updateFilters({ airlines: list });
  };

  const toggleTransitCity = (city: string) => {
    const list = filters.transitCities.includes(city)
      ? filters.transitCities.filter((c) => c !== city)
      : [...filters.transitCities, city];
    updateFilters({ transitCities: list });
  };

  const toggleTransitCount = (count: string) => {
    const list = filters.transitCount.includes(count)
      ? filters.transitCount.filter((c) => c !== count)
      : [...filters.transitCount, count];
    updateFilters({ transitCount: list });
  };

  const toggleAircraftType = (type: string) => {
    const list = filters.aircraftTypes.includes(type)
      ? filters.aircraftTypes.filter((t) => t !== type)
      : [...filters.aircraftTypes, type];
    updateFilters({ aircraftTypes: list });
  };

  const activeTags: { label: string; onRemove: () => void }[] = [];
  if (filters.directOnly)
    activeTags.push({ label: "只看直飞", onRemove: () => updateFilters({ directOnly: false }) });
  if (filters.studentTicket)
    activeTags.push({ label: "学生专享", onRemove: () => updateFilters({ studentTicket: false }) });
  if (filters.hasBaggage)
    activeTags.push({ label: "含行李额", onRemove: () => updateFilters({ hasBaggage: false }) });
  if (filters.noTransitVisa)
    activeTags.push({ label: "免过境签", onRemove: () => updateFilters({ noTransitVisa: false }) });
  if (filters.excludeCodeshare)
    activeTags.push({
      label: "无共享航班",
      onRemove: () => updateFilters({ excludeCodeshare: false }),
    });
  if (filters.excludeTax)
    activeTags.push({ label: "不含税价", onRemove: () => updateFilters({ excludeTax: false }) });
  if (filters.showOriginalPrice)
    activeTags.push({
      label: "优惠前价",
      onRemove: () => updateFilters({ showOriginalPrice: false }),
    });

  filters.alliances.forEach((a) => {
    const name = a === "star" ? "星空联盟" : a === "skyteam" ? "天合联盟" : "寰宇一家";
    activeTags.push({ label: name, onRemove: () => toggleAlliance(a) });
  });

  filters.airlines.forEach((code) => {
    activeTags.push({ label: code, onRemove: () => toggleAirline(code) });
  });

  filters.transitCities.forEach((code) => {
    activeTags.push({ label: `经 ${code}`, onRemove: () => toggleTransitCity(code) });
  });

  filters.transitCount.forEach((c) => {
    activeTags.push({
      label: c === "1" ? "1次中转" : "2次及以上中转",
      onRemove: () => toggleTransitCount(c),
    });
  });

  filters.aircraftTypes.forEach((t) => {
    activeTags.push({ label: "大型客机", onRemove: () => toggleAircraftType(t) });
  });

  if (filters.maxTransitDuration < 28) {
    activeTags.push({
      label: `中转 ≤ ${filters.maxTransitDuration}h`,
      onRemove: () => updateFilters({ maxTransitDuration: 28 }),
    });
  }

  if (filters.maxTotalDuration < 36) {
    activeTags.push({
      label: `总时长 ≤ ${filters.maxTotalDuration}h`,
      onRemove: () => updateFilters({ maxTotalDuration: 36 }),
    });
  }

  const hasAnyActiveFilter = activeTags.length > 0;

  return (
    <div className="flex flex-col gap-6 w-full gradient-bg min-h-screen">
      {/* 头部航线概要 */}
      <section className="flex items-center justify-between gap-2 p-1 shrink-0">
        <div>
          <RouteLabel origin={query.origin} dest={query.dest} size="lg" />
          <p className="mt-0.5 text-xs text-muted-foreground">
            {cabinLabel} · {query.trip_type === "round_trip" ? "往返" : "单程"} · {query.adults}{" "}
            人 · 采样 {meta.point_count} 天
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

      {/* 两栏式卡片布局 */}
      <div className="flex flex-col md:grid md:grid-cols-12 gap-7 items-start w-full">
        {/* 左侧栏：筛选面板、价格日历 */}
        <div className="flex flex-col gap-6 md:col-span-6 w-full">
          {/* 筛选控制器卡片 */}
          <Card className="w-full shadow-sm border-border/80">
          <CardContent className="p-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3.5 w-3.5" /> 筛选条件:
                </span>
                {activeTags.length === 0 ? (
                  <span className="text-xs text-muted-foreground bg-muted/30 px-2.5 py-0.5 rounded-full border border-border/30">
                    全部航班 (未启用筛选)
                  </span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {activeTags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-primary/5 text-primary border border-primary/20"
                      >
                        {tag.label}
                        <button
                          type="button"
                          onClick={tag.onRemove}
                          className="text-primary/70 hover:text-primary transition-colors cursor-pointer"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  className="gap-1 text-xs font-medium cursor-pointer"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {showFilterPanel ? "收起筛选" : "修改筛选"}
                  {showFilterPanel ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </Button>
                {hasAnyActiveFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetFilters()}
                    className="text-xs font-medium text-muted-foreground hover:text-primary cursor-pointer"
                  >
                    重置
                  </Button>
                )}
              </div>
            </div>

            {/* 折叠的高级筛选面板 */}
            {showFilterPanel && (
              <div className="border-t border-border/40 pt-4 grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {/* Column 1: 航班偏好 */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                      航班偏好
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <FilterButton
                        active={filters.directOnly}
                        onClick={() => updateFilters({ directOnly: !filters.directOnly })}
                        label="只看直飞"
                      />
                      <FilterButton
                        active={filters.studentTicket}
                        onClick={() => updateFilters({ studentTicket: !filters.studentTicket })}
                        label="学生专享"
                      />
                      <FilterButton
                        active={filters.hasBaggage}
                        onClick={() => updateFilters({ hasBaggage: !filters.hasBaggage })}
                        label="含行李额"
                      />
                      <FilterButton
                        active={filters.noTransitVisa}
                        onClick={() => updateFilters({ noTransitVisa: !filters.noTransitVisa })}
                        label="免过境签"
                      />
                      <FilterButton
                        active={filters.excludeCodeshare}
                        onClick={() => updateFilters({ excludeCodeshare: !filters.excludeCodeshare })}
                        label="无共享航班"
                      />
                      <FilterButton
                        active={filters.excludeTax}
                        onClick={() => updateFilters({ excludeTax: !filters.excludeTax })}
                        label="不含税价"
                      />
                      <FilterButton
                        active={filters.showOriginalPrice}
                        onClick={() => updateFilters({ showOriginalPrice: !filters.showOriginalPrice })}
                        label="优惠前价"
                      />
                    </div>
                  </div>

                  {/* Column 2: 航空公司与联盟 */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                      航空公司与联盟
                    </span>
                    <div className="flex flex-col gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">航空联盟</span>
                        <div className="grid grid-cols-3 gap-1">
                          <FilterButton
                            active={filters.alliances.includes("star")}
                            onClick={() => toggleAlliance("star")}
                            label="星空"
                          />
                          <FilterButton
                            active={filters.alliances.includes("skyteam")}
                            onClick={() => toggleAlliance("skyteam")}
                            label="天合"
                          />
                          <FilterButton
                            active={filters.alliances.includes("oneworld")}
                            onClick={() => toggleAlliance("oneworld")}
                            label="寰宇"
                          />
                        </div>
                      </div>

                      {allAirlines.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground font-medium">航空公司</span>
                          <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto thin-scroll">
                            {allAirlines.map((code) => (
                              <FilterButton
                                key={code}
                                active={filters.airlines.includes(code)}
                                onClick={() => toggleAirline(code)}
                                label={
                                  code === "MF"
                                    ? "厦门航空"
                                    : code === "CZ"
                                      ? "南方航空"
                                      : code === "SQ"
                                        ? "新加坡航"
                                        : code === "MU"
                                          ? "东方航空"
                                          : code === "CX"
                                            ? "国泰航空"
                                            : code
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 3: 中转与机型 */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                      中转与机型
                    </span>
                    <div className="flex flex-col gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium font-medium">
                          中转次数
                        </span>
                        <div className="grid grid-cols-2 gap-1">
                          <FilterButton
                            active={filters.transitCount.includes("1")}
                            onClick={() => toggleTransitCount("1")}
                            label="1次中转"
                          />
                          <FilterButton
                            active={filters.transitCount.includes("2+")}
                            onClick={() => toggleTransitCount("2+")}
                            label="2次及以上"
                          />
                        </div>
                      </div>

                      {allLayoverCities.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground font-medium font-medium">
                            中转城市
                          </span>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto thin-scroll">
                            {allLayoverCities.map((code) => (
                              <button
                                key={code}
                                type="button"
                                onClick={() => toggleTransitCity(code)}
                                className={cn(
                                  "px-2 py-0.5 rounded text-[9px] border transition-colors cursor-pointer",
                                  filters.transitCities.includes(code)
                                    ? "bg-primary/10 border-primary text-primary font-medium"
                                    : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {airportCity(code) || code}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">机型</span>
                        <FilterButton
                          active={filters.aircraftTypes.includes("large")}
                          onClick={() => toggleAircraftType("large")}
                          label="仅大型机"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sliders row */}
                <div className="grid gap-4 sm:grid-cols-2 border-t border-border/20 pt-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="transit-dur" className="text-[11px] font-medium text-muted-foreground">
                        最大中转时长
                      </Label>
                      <span className="text-[11px] font-semibold text-primary">
                        {filters.maxTransitDuration === 28 ? "不限" : `${filters.maxTransitDuration} 小时`}
                      </span>
                    </div>
                    <input
                      id="transit-dur"
                      type="range"
                      min="1"
                      max="28"
                      value={filters.maxTransitDuration}
                      onChange={(e) => updateFilters({ maxTransitDuration: Number(e.target.value) })}
                      className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] text-muted-foreground/80">
                      选择28小时即视为不限中转时长
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="total-dur" className="text-[11px] font-medium text-muted-foreground">
                        最大航程总时长
                      </Label>
                      <span className="text-[11px] font-semibold text-primary">
                        {filters.maxTotalDuration === 36 ? "不限" : `${filters.maxTotalDuration} 小时`}
                      </span>
                    </div>
                    <input
                      id="total-dur"
                      type="range"
                      min="5"
                      max="36"
                      value={filters.maxTotalDuration}
                      onChange={(e) => updateFilters({ maxTotalDuration: Number(e.target.value) })}
                      className="w-full accent-primary h-1 bg-muted rounded-lg appearance-none cursor-pointer"
                    />
                    <span className="text-[9px] text-muted-foreground/80">包含飞行和中转时间</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
          </Card>

          {/* 价格日历 */}
          <section className="flex flex-col gap-3">
            <SectionTitle showLine>
              📅 价格日历
              <span className="ml-2 text-xs font-normal text-muted-foreground/70 bg-muted/40 px-2 py-0.5 rounded-full">
                {displayResults.length} 天
              </span>
            </SectionTitle>
            <Card className="shadow-sm overflow-hidden relative">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-orange-400/50 via-primary/30 to-transparent" />
              <CardContent className="p-0">
                <PriceCalendar
                  results={displayResults}
                  currency={cur}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </CardContent>
            </Card>
          </section>
        </div>

        {/* 右侧栏：快速结论、价格趋势、航班详情、省钱机会 */}
        <div className="flex flex-col gap-6 md:col-span-6 w-full">
          {/* 航班详情（所选日期） */}
          <section className="flex flex-col gap-3">
            <SectionTitle icon={<Plane className="h-4 w-4 text-primary" />} showLine>
              所选日期航班详情
              <span className="ml-2 text-xs font-normal text-primary/70 bg-primary/[0.06] px-2 py-0.5 rounded-full">
                {selectedDate}
              </span>
            </SectionTitle>
            
            {detailLoading ? (
              <Card className="border border-border/85 shadow-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <p className="text-xs">正在实时加载航班航程信息...</p>
                </CardContent>
              </Card>
            ) : detailError ? (
              <Card className="border border-border/85 shadow-sm">
                <CardContent className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <AlertTriangle className="h-6 w-6 text-warn" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">获取航班详情失败</p>
                    <p className="text-xs text-muted-foreground mt-1">{detailError}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      const d = selectedDate;
                      setSelectedDate(null);
                      setTimeout(() => setSelectedDate(d), 50);
                    }}
                    className="mt-2 text-xs cursor-pointer"
                  >
                    重试
                  </Button>
                </CardContent>
              </Card>
            ) : selectedDateDetail ? (
              <Card className="border border-border/60 shadow-sm flex flex-col overflow-hidden relative">
                {/* 顶部装饰 */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/40 via-info/30 to-transparent" />
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* Header info */}
                  <div className="flex items-center justify-between pb-3 border-b border-border/30">
                    <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary animate-[pulse_2s_ease-in-out_infinite]" />
                      {selectedDateDetail.return_date ? "往返行程" : "单程行程"}
                    </span>
                    <span className="text-primary font-bold text-base gradient-text">
                      {fmtPrice(selectedDateDetail.alt_price, cur)}
                    </span>
                  </div>

                  {/* Timeline */}
                  <div className="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-1">
                    {generateItinerary(selectedDateDetail, false).map((item, idx) => {
                      if (item.type === "flight") {
                        return (
                          <div key={idx} className="flex gap-3 text-xs">
                            {/* Times */}
                            <div className="w-14 shrink-0 text-right flex flex-col justify-between py-0.5">
                              <div>
                                <div className="font-bold text-foreground text-sm">{item.departTime}</div>
                                <div className="text-[9px] text-muted-foreground font-medium">{item.departDate}</div>
                              </div>
                              <div className="my-2 text-[9px] text-muted-foreground/60 font-semibold">{item.duration}</div>
                              <div>
                                <div className="font-bold text-foreground text-sm">{item.arriveTime}</div>
                                <div className="text-[9px] text-muted-foreground font-medium">{item.arriveDate}</div>
                              </div>
                            </div>

                            {/* Track line */}
                            <div className="flex flex-col items-center py-1 shrink-0">
                              <div className="h-2.5 w-2.5 rounded-full border border-primary bg-card z-10 shrink-0 flex items-center justify-center">
                                <div className="h-1 w-1 rounded-full bg-primary" />
                              </div>
                              <div className="w-0.5 border-l border-dashed border-border/70 flex-1 my-1 min-h-[40px]" />
                              <div className="h-2.5 w-2.5 rounded-full border border-info bg-card z-10 shrink-0 flex items-center justify-center">
                                <div className="h-1 w-1 rounded-full bg-info" />
                              </div>
                            </div>

                            {/* Details */}
                            <div className="flex-1 flex flex-col justify-between min-w-0">
                              <div className="truncate font-semibold text-foreground text-sm flex items-center gap-1">
                                <span className="font-extrabold text-primary text-base">{item.origin}</span>
                                <span className="text-[10px] text-muted-foreground font-medium truncate">
                                  {formatAirportWithLang(item.origin || "", false)}
                                </span>
                              </div>
                              <div className="my-2 p-3 rounded-xl border border-border/40 bg-gradient-to-br from-muted/25 to-muted/10 text-[10px] text-muted-foreground flex flex-col gap-1.5 shadow-sm">
                                <div className="flex justify-between font-semibold">
                                  <span className="flex items-center gap-1">
                                    <span className="inline-block h-4 w-4 rounded bg-primary/10 text-primary text-[8px] font-bold flex items-center justify-center">✈</span>
                                    {item.carrier} <b className="text-primary font-bold">{item.flightNumber}</b>
                                  </span>
                                  <span className="text-muted-foreground/80">{item.cabin}</span>
                                </div>
                                <div className="flex justify-between text-[9px] text-muted-foreground/70">
                                  <span>{item.aircraft || "波音 777"}</span>
                                  <span className="text-good font-semibold">{item.meals}</span>
                                </div>
                              </div>
                              <div className="truncate font-semibold text-foreground text-sm flex items-center gap-1">
                                <span className="font-extrabold text-info text-base">{item.dest}</span>
                                <span className="text-[10px] text-muted-foreground font-medium truncate">
                                  {formatAirportWithLang(item.dest || "", false)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      } else if (item.type === "layover") {
                        return (
                          <div key={idx} className="flex gap-3 my-1 text-xs">
                            <div className="w-14 shrink-0" />
                            <div className="flex flex-col items-center shrink-0">
                              <div className="w-0.5 border-l border-dashed border-border/70 flex-1 min-h-[24px]" />
                            </div>
                            <div className="flex-1 bg-muted/30 border border-border/40 rounded-lg p-2 text-[10px]">
                              <span className="font-semibold text-foreground">
                                中转 {item.city} · {item.layoverDuration}
                              </span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Action Link */}
                  <div className="pt-3 border-t border-border/30 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">
                      数据来源 · Google Flights
                    </span>
                    <a href={selectedDateDetail.deeplink} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" className="h-8 text-xs gap-1.5 cursor-pointer bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-sm">
                        <Plane className="h-3 w-3" />
                        去订票
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border border-border/85 shadow-sm">
                <CardContent className="p-6 text-center text-xs text-muted-foreground">
                  所选日期暂无直飞/联程航班详情。
                </CardContent>
              </Card>
            )}
          </section>

          {/* 价格趋势 */}
          {displayResults.length > 1 && (
            <section className="shrink-0 flex flex-col gap-3">
              <SectionTitle showLine>📈 价格趋势</SectionTitle>
              <Card className="shadow-sm overflow-hidden relative">
                {/* 顶部装饰 */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/50 via-info/30 to-transparent" />
                <CardContent className="p-4 bg-gradient-to-br from-card via-card to-primary/[0.02]">
                  <div className="h-60 md:h-72 relative">
                    <PriceChart 
                      results={displayResults} 
                      currency={cur} 
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                    />
                  </div>
                </CardContent>
              </Card>
            </section>
          )}

          {/* 省钱机会 */}
          <section className="flex flex-col gap-3">
            <SectionTitle icon={<Sparkles className="h-4 w-4 text-warn" />} showLine>
              省钱机会
              <span className="ml-2 text-xs font-normal text-warn/80 bg-warn/[0.08] px-2 py-0.5 rounded-full">
                {displayOpportunities.length} 个
              </span>
            </SectionTitle>
            <div className="flex flex-col gap-3">
              {displayOpportunities.length === 0 ? (
                <div className="flex items-center justify-center p-6 border border-dashed rounded-xl bg-muted/10 text-center">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">未发现符合筛选条件的省钱机会</p>
                    <p className="mt-1 text-xs text-muted-foreground/60 max-w-xs">当前筛选条件可能偏严格，可以试着放宽某些筛选选项。</p>
                  </div>
                </div>
              ) : (
                <div className="grid items-stretch gap-3 grid-cols-1">
                  {displayOpportunities.map((op, i) => (
                    <OpportunityCard key={`${op.type}-${i}`} op={op} index={i} />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 快速结论：现在买贵不贵 */}
          <Card className="overflow-hidden border-primary/15 shadow-sm shrink-0 relative">
            {/* 顶部装饰渐变条 */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-info/40 to-good/50" />
            <CardContent className="grid gap-4 p-5 grid-cols-3 bg-gradient-to-br from-card via-card to-primary/[0.03]">
              <Verdict
                q="💰 现在买贵不贵？"
                main={
                  cheapest != null ? (
                    <Money
                      value={cheapest}
                      currency={cur}
                      className="text-xl font-bold tracking-tight gradient-text"
                    />
                  ) : (
                    <span className="text-lg text-muted-foreground">—</span>
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
              {/* 渐变分隔线 */}
              <div className="verdict-divider w-px" />
              <Verdict
                q="✨ 有没有更便宜？"
                className="pl-4"
                main={
                  top ? (
                    <span className="tnum text-lg font-bold tracking-tight text-good">
                      省 {fmtPrice(top.saving, cur)}
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">暂未发现</span>
                  )
                }
                extra={
                  <span className="text-[10px] text-muted-foreground truncate">
                    {displayOpportunities.length > 0
                      ? `共 ${displayOpportunities.length} 个省钱机会`
                      : "当前窗口较平稳"}
                  </span>
                }
              />
              {/* 渐变分隔线 */}
              <div className="verdict-divider w-px" />
              <Verdict
                q="🎯 推荐买吗？"
                className="pl-4"
                main={
                  top ? (
                    <RecommendationStars count={top.stars} action={top.action} />
                  ) : (
                    <span className="text-sm font-medium text-muted-foreground">继续关注</span>
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
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      key={label}
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-1 text-[10px] font-medium transition-all duration-200 cursor-pointer w-full text-center truncate",
        active
          ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
          : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
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
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <p className="text-[11px] font-semibold text-muted-foreground/80 tracking-wide">{q}</p>
      <div className="flex min-h-10 items-center">{main}</div>
      {extra && <div className="flex items-center gap-2">{extra}</div>}
    </div>
  );
}

function SectionTitle({
  children,
  icon,
  showLine,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  showLine?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        {icon}
        {children}
      </h2>
      {showLine && <div className="section-line w-12" />}
    </div>
  );
}
