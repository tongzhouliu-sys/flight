import { cn } from "@/lib/utils";
import { fmtPrice, stopsLabel, weekday } from "@/lib/format";
import type { CalendarResult } from "@/types";

export function ResultsTable({
  results,
  currency,
}: {
  results: CalendarResult[];
  currency: string;
}) {
  const sorted = [...results].sort((a, b) =>
    a.depart_date.localeCompare(b.depart_date),
  );
  const min = results.length ? Math.min(...results.map((r) => r.price)) : 0;

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">出发日</th>
            <th className="px-4 py-2.5 font-medium">星期</th>
            <th className="px-4 py-2.5 font-medium">返回日</th>
            <th className="px-4 py-2.5 font-medium">价格</th>
            <th className="px-4 py-2.5 font-medium">承运</th>
            <th className="px-4 py-2.5 font-medium">中转</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr
              key={`${r.depart_date}-${r.return_date ?? ""}`}
              className={cn(
                "border-b border-border last:border-0",
                r.price === min && "bg-good/5",
              )}
            >
              <td className="px-4 py-2.5 font-medium">{r.depart_date}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {weekday(r.depart_date)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.return_date ?? "—"}
              </td>
              <td className="px-4 py-2.5 tnum font-semibold">
                {fmtPrice(r.price, currency)}
                {r.price === min && (
                  <span className="ml-1.5 text-xs font-normal text-good">
                    最低
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.carrier ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {r.stops == null ? "—" : stopsLabel(r.stops)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
