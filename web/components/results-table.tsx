import { cn } from "@/lib/utils";
import { fmtPrice, stopsLabel, weekday } from "@/lib/format";
import { LEVEL_META, levelFromWindow } from "@/lib/price-level";
import { useCurrencyStore } from "@/lib/currency";
import type { CalendarResult } from "@/types";

export function ResultsTable({
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
  // 订阅汇率以支持响应式更新
  useCurrencyStore((s) => s.rate);

  const sorted = [...results].sort((a, b) =>
    a.depart_date.localeCompare(b.depart_date),
  );
  const prices = results.map((r) => r.price);
  const min = prices.length ? Math.min(...prices) : 0;
  const max = prices.length ? Math.max(...prices) : 0;

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* 图例：说明圆点为本次窗口内相对价位 */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground shrink-0 px-1">
        <span className="font-medium">本次窗口内相对价位:</span>
        <Legend dot="bg-good" label="偏低" />
        <Legend dot="bg-warn" label="中等" />
        <Legend dot="bg-bad" label="偏高" />
      </div>
 
      <div className="overflow-x-auto overflow-y-visible rounded-xl border border-border/60 bg-card/80 backdrop-blur-sm shadow-sm">
        <table className="w-full min-w-[560px] text-sm relative border-collapse">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground/70 font-semibold">
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">出发日</th>
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">星期</th>
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">返回日</th>
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">价格</th>
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">航空公司</th>
              <th className="sticky top-14 bg-muted/30 backdrop-blur-sm z-10 px-4 py-3 font-semibold border-b border-border/40">中转</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, rowIdx) => {
              const isMin = r.price === min;
              const level = levelFromWindow(r.price, min, max);
              const dot = level ? LEVEL_META[level].dot : "bg-muted-foreground/40";
              const isSelected = selectedDate === r.depart_date;
              const isEven = rowIdx % 2 === 0;
              return (
                <tr
                  key={`${r.depart_date}-${r.return_date ?? ""}`}
                  onClick={() => onSelectDate?.(r.depart_date)}
                  className={cn(
                    "border-b border-border/30 last:border-0 cursor-pointer select-none relative group",
                    "transition-all duration-200 ease-out",
                    isEven ? "bg-transparent" : "bg-muted/15",
                    isMin && !isSelected && "bg-good/[0.04]",
                    isSelected
                      ? "bg-primary/[0.06] shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]"
                      : "hover:bg-muted/30",
                  )}
                >
                  <td className="px-4 py-3 font-medium relative">
                    {isSelected && (
                      <div className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-primary animate-[fadeIn_0.2s_ease-out]" />
                    )}
                    <span className={cn(
                      "transition-colors duration-150",
                      isSelected ? "text-primary font-bold" : "group-hover:text-foreground",
                    )}>
                      {r.depart_date}
                    </span>
                  </td>
                  <td className={cn(
                    "px-4 py-3 transition-colors duration-150",
                    isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground/80",
                  )}>
                    {weekday(r.depart_date)}
                  </td>
                  <td className={cn(
                    "px-4 py-3 transition-colors duration-150",
                    isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground/80",
                  )}>
                    {r.return_date ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2 w-2 shrink-0 rounded-full transition-transform duration-200",
                          dot,
                          isSelected && "scale-125",
                        )}
                        title={level ? LEVEL_META[level].zh : undefined}
                        aria-hidden
                      />
                      <span className={cn(
                        "tnum font-semibold transition-all duration-150",
                        isSelected ? "text-primary font-bold text-[15px]" : "group-hover:text-foreground",
                      )}>
                        {fmtPrice(r.price, currency)}
                      </span>
                      {isMin && (
                        <span className="rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-semibold text-good border border-good/20 animate-[fadeIn_0.3s_ease-out]">
                          最低
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={cn(
                    "px-4 py-3 transition-colors duration-150",
                    isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground/80",
                  )}>
                    {r.carrier ?? "—"}
                  </td>
                  <td className={cn(
                    "px-4 py-3 transition-colors duration-150",
                    isSelected ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground/80",
                  )}>
                    {r.stops == null ? "—" : stopsLabel(r.stops)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
      <span className="text-[11px]">{label}</span>
    </span>
  );
}
