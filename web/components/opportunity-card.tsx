import Link from "next/link";
import { ChevronRight, Plane } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { ExplainBlock } from "@/components/explain-block";
import { Money } from "@/components/money";
import { PriceLevelBadge } from "@/components/price-level-badge";
import { RecommendationStars } from "@/components/recommendation-stars";
import { RiskBadges } from "@/components/risk-badges";
import { TYPE_TONE, oppMeta } from "@/lib/constants";
import { fmtPrice, weekday } from "@/lib/format";
import {
  discountPct,
  levelForOpportunity,
  readPercentile,
} from "@/lib/price-level";
import type { Opportunity } from "@/types";

export function OpportunityCard({
  op,
  index,
}: {
  op: Opportunity;
  index: number;
}) {
  const meta = oppMeta(op.type, op.type_label);
  const level = levelForOpportunity(
    readPercentile(op.detail),
    op.base_price,
    op.alt_price,
  );
  const disc = discountPct(op.base_price, op.alt_price);

  return (
    <Link href={`/opportunity/${index}`} className="group block">
      <Card className="h-full transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-pop">
        <CardContent className="flex h-full flex-col gap-3.5 p-5">
          {/* 类型（说人话 + 英文悬停）｜ 推荐档 */}
          <div className="flex items-start justify-between gap-3">
            <Tooltip label={meta.en}>
              <Badge tone={TYPE_TONE[op.type] ?? "muted"}>{meta.zh}</Badge>
            </Tooltip>
            <RecommendationStars count={op.stars} action={op.action} />
          </div>

          {/* 航线 + 日期 */}
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Plane className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">
              {op.origin} → {op.dest}
            </span>
            {op.depart_date && (
              <span>
                · {op.depart_date} {weekday(op.depart_date)}
              </span>
            )}
          </p>

          {/* 价格 + 水位 + 便宜幅度（贵不贵 + 更便宜方案） */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <Money
                value={op.alt_price}
                currency={op.currency}
                className="text-2xl font-bold tracking-tight"
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <PriceLevelBadge level={level} size="sm" />
                {disc != null && (
                  <span className="text-xs text-muted-foreground">
                    比参考价便宜 <b className="text-good">{disc}%</b>
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-xs text-muted-foreground">立省</p>
              <p className="tnum text-lg font-semibold text-good">
                {fmtPrice(op.saving, op.currency)}
              </p>
            </div>
          </div>

          {/* 注意事项 */}
          <RiskBadges tags={op.risk_tags} hardBlock={op.hard_block} />

          {/* 推荐原因 */}
          <ExplainBlock op={op} />

          <span className="mt-auto flex items-center gap-1 self-end text-xs font-medium text-muted-foreground transition-colors group-hover:text-primary">
            查看详情 <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}
