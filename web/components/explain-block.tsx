import { fmtPrice } from "@/lib/format";
import type { Explain } from "@/types";

export function ExplainBlock({
  explain,
  currency,
}: {
  explain: Explain;
  currency: string;
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3 text-sm">
      <p className="font-medium">{explain.headline}</p>
      <p className="mt-1 text-muted-foreground">
        {explain.route}：{explain.from.label} (
        {fmtPrice(explain.from.price, currency)}) ➔ {explain.to.label} (
        {fmtPrice(explain.to.price, currency)})
      </p>
      {explain.note && (
        <p className="mt-1 text-xs text-muted-foreground">说明：{explain.note}</p>
      )}
    </div>
  );
}
