"use client";

import { cn } from "@/lib/utils";
import { fmtPrice } from "@/lib/format";
import { useCurrencyStore } from "@/lib/currency";
import type { CalendarResult } from "@/types";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

interface MonthData {
  year: number;
  month: number; // 0-indexed
  label: string;
  days: (DayCell | null)[];
}

interface DayCell {
  day: number;
  date: string; // YYYY-MM-DD
  price: number | null;
  currency: string;
  isWeekend: boolean;
  isCheapest: boolean;
  result: CalendarResult | null;
}

function groupByMonth(
  results: CalendarResult[],
  globalMin: number,
): MonthData[] {
  // Build a map of date -> result
  const dateMap = new Map<string, CalendarResult>();
  for (const r of results) {
    dateMap.set(r.depart_date, r);
  }

  // Find all distinct year-month combos
  const months = new Map<string, { year: number; month: number }>();
  for (const r of results) {
    const d = new Date(`${r.depart_date}T00:00:00`);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!months.has(key)) {
      months.set(key, { year: d.getFullYear(), month: d.getMonth() });
    }
  }

  // Sort months chronologically
  const sortedMonths = [...months.values()].sort(
    (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
  );

  return sortedMonths.map(({ year, month }) => {
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startWeekday = firstDay.getDay(); // 0=Sun

    // Create grid: null for empty cells before first day
    const days: (DayCell | null)[] = [];

    // Leading empty cells
    for (let i = 0; i < startWeekday; i++) {
      days.push(null);
    }

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const result = dateMap.get(dateStr) || null;
      const dayOfWeek = new Date(year, month, d).getDay();
      days.push({
        day: d,
        date: dateStr,
        price: result ? result.price : null,
        currency: result ? result.currency : "SGD",
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
        isCheapest: result ? result.price === globalMin : false,
        result,
      });
    }

    return {
      year,
      month,
      label: `${year} 年 ${month + 1} 月`,
      days,
    };
  });
}

export function PriceCalendar({
  results,
  currency,
  selectedDate,
  onSelectDate,
}: {
  results: CalendarResult[];
  currency: string;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}) {
  useCurrencyStore((s) => s.rate);

  const prices = results.map((r) => r.price);
  const globalMin = prices.length ? Math.min(...prices) : 0;
  const months = groupByMonth(results, globalMin);

  return (
    <div className="flex flex-col gap-0 w-full">
      {/* Sticky weekday header */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-md border-b border-border/40 shadow-sm">
        <div className="grid grid-cols-7 text-center">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "py-2.5 text-xs font-bold tracking-wider",
                i === 0 || i === 6
                  ? "text-orange-500"
                  : "text-muted-foreground",
              )}
            >
              {w}
            </div>
          ))}
        </div>
      </div>

      {/* Month sections */}
      {months.map((m) => (
        <div key={`${m.year}-${m.month}`} className="flex flex-col">
          {/* Month label */}
          <div className="px-3 py-3 text-sm font-bold text-foreground tracking-wide border-b border-border/20">
            {m.label}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {m.days.map((cell, idx) => {
              if (!cell) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="aspect-square border-b border-r border-border/[0.06]"
                  />
                );
              }

              const isSelected = selectedDate === cell.date;
              const hasPrice = cell.price !== null;
              const isToday = cell.date === new Date().toISOString().slice(0, 10);

              return (
                <button
                  key={cell.date}
                  type="button"
                  disabled={!hasPrice}
                  onClick={() => hasPrice && onSelectDate?.(cell.date)}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 py-2.5 px-1 min-h-[64px] md:min-h-[72px]",
                    "border-b border-r border-border/[0.06]",
                    "transition-all duration-200 ease-out",
                    // Base state
                    hasPrice
                      ? "cursor-pointer hover:bg-primary/[0.04] active:scale-95"
                      : "cursor-default opacity-40",
                    // Selected state
                    isSelected &&
                      "bg-primary text-white rounded-xl shadow-md shadow-primary/20 scale-[1.02] z-10 border-transparent hover:bg-primary/90",
                  )}
                >
                  {/* Today indicator */}
                  {isToday && !isSelected && (
                    <div className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}

                  {/* Date number */}
                  <span
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      isSelected
                        ? "text-white"
                        : cell.isWeekend
                          ? "text-orange-500"
                          : "text-foreground",
                    )}
                  >
                    {cell.day}
                  </span>

                  {/* Price */}
                  {hasPrice ? (
                    <span
                      className={cn(
                        "text-[11px] font-semibold leading-tight tnum",
                        isSelected
                          ? "text-white/90"
                          : cell.isCheapest
                            ? "text-orange-500 font-bold"
                            : "text-muted-foreground",
                      )}
                    >
                      {fmtPrice(cell.price, currency)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/40 leading-tight">
                      —
                    </span>
                  )}

                  {/* Cheapest badge */}
                  {cell.isCheapest && !isSelected && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-500 border border-card" />
                  )}

                  {/* Selected label */}
                  {isSelected && (
                    <span className="text-[9px] font-bold text-white/80 leading-tight mt-0.5">
                      去程
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-3 text-[11px] text-muted-foreground border-t border-border/20">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" />
          最低价
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 rounded bg-primary" />
          已选日期
        </span>
      </div>
    </div>
  );
}
