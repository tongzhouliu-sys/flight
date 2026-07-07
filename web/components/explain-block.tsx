import { ArrowRight } from "lucide-react";
import { oppMeta } from "@/lib/constants";
import { fmtPrice } from "@/lib/format";
import type { Opportunity } from "@/types";

/**
 * 推荐原因（说人话）：一句话解释这类机会 + 「原方案 → 更便宜方案」的价格对比证据。
 * 回答「有没有更便宜的方案」。
 */
export function ExplainBlock({ op }: { op: Opportunity }) {
  const meta = oppMeta(op.type, op.type_label);
  const { from, to } = op.explain;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
      <p className="text-muted-foreground">{meta.tagline}</p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">{from.label ?? "原方案"}</span>
        <span className="tnum font-medium text-muted-foreground line-through decoration-muted-foreground/40">
          {fmtPrice(from.price, op.currency)}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-foreground">{to.label ?? "更便宜方案"}</span>
        <span className="tnum font-semibold text-good">
          {fmtPrice(to.price, op.currency)}
        </span>
      </div>
    </div>
  );
}
