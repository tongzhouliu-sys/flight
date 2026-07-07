import { cn } from "@/lib/utils";
import { fmtPrice, stopsLabel, weekday } from "@/lib/format";
import { LEVEL_META, levelFromWindow } from "@/lib/price-level";
import { useCurrencyStore } from "@/lib/currency";
import type { CalendarResult } from "@/types";

export function ResultsTable({
  results,
  currency,
}: {
  results: CalendarResult[];
  currency: string;
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
    <div className="flex flex-col gap-2">
      {/* 图例：说明圆点为本次窗口内相对价位 */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>本次窗口内相对价位</span>
        <Legend dot="bg-good" label="偏低" />
        <Legend dot="bg-warn" label="中等" />
        <Legend dot="bg-bad" label="偏高" />
      </div>

      <div className="thin-scroll overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">出发日</th>
              <th className="px-4 py-2.5 font-medium">星期</th>
              <th className="px-4 py-2.5 font-medium">返回日</th>
              <th className="px-4 py-2.5 font-medium">价格</th>
              <th className="px-4 py-2.5 font-medium">航空公司</th>
              <th className="px-4 py-2.5 font-medium">中转</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isMin = r.price === min;
              const level = levelFromWindow(r.price, min, max);
              const dot = level ? LEVEL_META[level].dot : "bg-muted-foreground/40";
              return (
                <tr
                  key={`${r.depart_date}-${r.return_date ?? ""}`}
                  className={cn(
                    "border-b border-border transition-colors last:border-0 hover:bg-muted/40",
                    isMin && "bg-good/5",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">{r.depart_date}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {weekday(r.depart_date)}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.return_date ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", dot)}
                        title={level ? LEVEL_META[level].zh : undefined}
                        aria-hidden
                      />
                      <span className="tnum font-semibold">
                        {fmtPrice(r.price, currency)}
                      </span>
                      {isMin && (
                        <span className="rounded bg-good/15 px-1.5 py-0.5 text-xs font-medium text-good">
                          最低
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.carrier ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
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
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", dot)} aria-hidden />
      {label}
    </span>
  );
}
