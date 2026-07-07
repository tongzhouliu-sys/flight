"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
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
  date_mode: "flex3",
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="origin">出发机场</Label>
              <Input
                id="origin"
                placeholder="如 SIN"
                maxLength={3}
                value={form.origin}
                onChange={(e) => set("origin", e.target.value.toUpperCase())}
                className="uppercase"
              />
            </div>
            <div>
              <Label htmlFor="dest">到达机场</Label>
              <Input
                id="dest"
                placeholder="如 HKG"
                maxLength={3}
                value={form.dest}
                onChange={(e) => set("dest", e.target.value.toUpperCase())}
                className="uppercase"
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

          {error && <p className="text-sm font-medium text-bad">{error}</p>}

          <Button
            type="submit"
            size="lg"
            className="w-full gap-2 sm:w-auto sm:self-end"
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
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            value === o.value
              ? "bg-card font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
