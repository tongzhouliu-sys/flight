"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Search, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { AirportCombobox } from "@/components/airport-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CABINS, DATE_MODES, TRIP_TYPES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSearchStore } from "@/store/search";
import type { Cabin, DateMode, SearchParams, TripType } from "@/types";

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const DEFAULTS: SearchParams = {
  origin: "",
  dest: "",
  depart_date: todayPlus(30),
  return_date: todayPlus(40),
  trip_type: "one_way",
  cabin: "ECONOMY",
  adults: 1,
  date_mode: "next30",
};

export function SearchForm({
  initial,
  autoSubmit = false,
}: {
  initial?: Partial<SearchParams> | null;
  autoSubmit?: boolean;
}) {
  const router = useRouter();
  const runSearch = useSearchStore((s) => s.runSearch);

  const [form, setForm] = useState<SearchParams>({ ...DEFAULTS, ...(initial ?? {}) });
  const [error, setError] = useState<string | null>(null);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const filters = useSearchStore((s) => s.filters);
  const updateFilters = useSearchStore((s) => s.updateFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);

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

  const toggleTransitCity = (city: string) => {
    const list = filters.transitCities.includes(city)
      ? filters.transitCities.filter((c) => c !== city)
      : [...filters.transitCities, city];
    updateFilters({ transitCities: list });
  };

  const flexNeedsDate = form.date_mode === "exact" || form.date_mode === "flex3";
  const isRoundTrip = form.trip_type === "round_trip";

  const set = <K extends keyof SearchParams>(key: K, value: SearchParams[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = useMemo(
    () => (): string | null => {
      if (form.origin.trim().length !== 3 || form.dest.trim().length !== 3)
        return "出发/到达机场须为 3 字母机场码";
      if (form.origin.trim().toUpperCase() === form.dest.trim().toUpperCase())
        return "出发与到达机场不能相同";
      if (flexNeedsDate && !form.depart_date) return "该日期模式需要出发日期";
      if (isRoundTrip && !form.return_date) return "往返需要返回日期";
      if (
        form.depart_date &&
        form.return_date &&
        isRoundTrip &&
        form.return_date <= form.depart_date
      )
        return "返回日期须晚于出发日期";
      return null;
    },
    [form, flexNeedsDate, isRoundTrip],
  );

  function submit() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const params: SearchParams = {
      origin: form.origin.trim().toUpperCase(),
      dest: form.dest.trim().toUpperCase(),
      depart_date: form.depart_date || null,
      return_date: isRoundTrip ? form.return_date || null : null,
      trip_type: form.trip_type,
      cabin: form.cabin,
      adults: Number(form.adults) || 1,
      date_mode: form.date_mode,
    };
    void runSearch(params);
    router.push("/results");
  }

  // 历史「重新查询」：带入 initial 后自动执行一次
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (autoSubmit && initial) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardContent className="pt-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          {/* 机场 */}
          <div className="relative grid gap-4 sm:grid-cols-[1fr_auto_1fr] items-end">
            <div className="w-full">
              <Label htmlFor="origin">出发机场</Label>
              <AirportCombobox
                id="origin"
                value={form.origin}
                onChange={(v) => set("origin", v)}
                placeholder="输入城市或机场代码，如 SIN"
              />
            </div>

            {/* 左右对调按钮 */}
            <div className="flex justify-center pb-0.5 sm:pb-1">
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({
                    ...f,
                    origin: f.dest,
                    dest: f.origin,
                  }));
                }}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 shadow-sm cursor-pointer"
                title="对调出发/到达机场"
              >
                <ArrowLeftRight className="h-4 w-4 rotate-90 sm:rotate-0" />
              </button>
            </div>

            <div className="w-full">
              <Label htmlFor="dest">到达机场</Label>
              <AirportCombobox
                id="dest"
                value={form.dest}
                onChange={(v) => set("dest", v)}
                placeholder="输入城市或机场代码，如 HKG"
              />
            </div>
          </div>

          {/* 行程类型 */}
          <div>
            <Label>行程类型</Label>
            <Segmented
              options={TRIP_TYPES.map((t) => ({ value: t.value, label: t.label }))}
              value={form.trip_type}
              onChange={(v) => set("trip_type", v as TripType)}
            />
          </div>

          {/* 日期 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="depart">
                出发日期{!flexNeedsDate && "（未来 N 天模式下作参考）"}
              </Label>
              <Input
                id="depart"
                type="date"
                min={todayPlus(0)}
                value={form.depart_date ?? ""}
                onChange={(e) => set("depart_date", e.target.value)}
              />
            </div>
            {isRoundTrip && (
              <div>
                <Label htmlFor="ret">返回日期</Label>
                <Input
                  id="ret"
                  type="date"
                  min={form.depart_date ?? todayPlus(0)}
                  value={form.return_date ?? ""}
                  onChange={(e) => set("return_date", e.target.value)}
                />
              </div>
            )}
          </div>

          {/* 日期模式 */}
          <div>
            <Label>日期灵活度</Label>
            <Segmented
              options={DATE_MODES.map((m) => ({ value: m.value, label: m.label }))}
              value={form.date_mode}
              onChange={(v) => set("date_mode", v as DateMode)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {DATE_MODES.find((m) => m.value === form.date_mode)?.hint}
            </p>
          </div>

          {/* 舱位 + 人数 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="cabin">舱位</Label>
              <Select
                id="cabin"
                value={form.cabin}
                onChange={(e) => set("cabin", e.target.value as Cabin)}
              >
                {CABINS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="adults">成人人数</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={9}
                value={form.adults}
                onChange={(e) => set("adults", Number(e.target.value))}
              />
            </div>
          </div>

          {/* 高级筛选 */}
          <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer select-none"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>高级筛选条件</span>
                {showAdvanced ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              
              {showAdvanced && (
                <button
                  type="button"
                  onClick={() => resetFilters()}
                  className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                >
                  重置筛选
                </button>
              )}
            </div>

            {showAdvanced && (
              <div className="grid gap-5 border-t border-border/20 pt-4">
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                  {/* Column 1: 航班偏好 */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">航班偏好</span>
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
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">航空公司与联盟</span>
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
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">航空公司</span>
                        <div className="grid grid-cols-2 gap-1">
                          <FilterButton
                            active={filters.airlines.includes("MF")}
                            onClick={() => toggleAirline("MF")}
                            label="厦门航空"
                          />
                          <FilterButton
                            active={filters.airlines.includes("CZ")}
                            onClick={() => toggleAirline("CZ")}
                            label="南方航空"
                          />
                          <FilterButton
                            active={filters.airlines.includes("SQ")}
                            onClick={() => toggleAirline("SQ")}
                            label="新加坡航"
                          />
                          <FilterButton
                            active={filters.airlines.includes("MU")}
                            onClick={() => toggleAirline("MU")}
                            label="东方航空"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: 中转与机型 */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">中转与机型</span>
                    <div className="flex flex-col gap-2 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">中转次数</span>
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
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-muted-foreground font-medium">中转城市</span>
                        <div className="grid grid-cols-4 gap-1">
                          <FilterButton
                            active={filters.transitCities.includes("SZX")}
                            onClick={() => toggleTransitCity("SZX")}
                            label="深圳"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("CAN")}
                            onClick={() => toggleTransitCity("CAN")}
                            label="广州"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("PEK")}
                            onClick={() => toggleTransitCity("PEK")}
                            label="北京"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("CTU")}
                            onClick={() => toggleTransitCity("CTU")}
                            label="成都"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("XMN")}
                            onClick={() => toggleTransitCity("XMN")}
                            label="厦门"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("PVG")}
                            onClick={() => toggleTransitCity("PVG")}
                            label="上海"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("MNL")}
                            onClick={() => toggleTransitCity("MNL")}
                            label="马尼拉"
                          />
                          <FilterButton
                            active={filters.transitCities.includes("HKG")}
                            onClick={() => toggleTransitCity("HKG")}
                            label="香港"
                          />
                        </div>
                      </div>
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
                      <Label htmlFor="transit-dur" className="text-[11px] font-medium text-muted-foreground">最大中转时长</Label>
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
                    <span className="text-[9px] text-muted-foreground/80">选择28小时即视为不限中转时长</span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="total-dur" className="text-[11px] font-medium text-muted-foreground">最大航程总时长</Label>
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
          </div>

          {error && <p className="text-sm font-medium text-bad">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 sm:w-auto sm:self-end bg-gradient-to-r from-primary to-info hover:opacity-95 hover:shadow-lg hover:shadow-primary/15 transition-all duration-200 font-semibold active:scale-[0.98]"
          >
            <Search className="h-4 w-4" />
            搜索省钱机会
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-border bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm transition-all duration-200",
            value === o.value
              ? "bg-card font-semibold text-foreground shadow-sm scale-[1.02] border border-border/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          {o.label}
        </button>
      ))}
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
        "flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 cursor-pointer w-full text-center truncate",
        active
          ? "bg-primary/10 border-primary text-primary font-semibold shadow-sm"
          : "bg-card border-border hover:bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}
