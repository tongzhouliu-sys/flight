import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExplainBlock } from "@/components/explain-block";
import { RecommendationStars } from "@/components/recommendation-stars";
import { RiskBadges } from "@/components/risk-badges";
import { TYPE_TONE } from "@/lib/constants";
import { fmtPrice, weekday } from "@/lib/format";
import type { Opportunity } from "@/types";

export function OpportunityCard({
  op,
  index,
}: {
  op: Opportunity;
  index: number;
}) {
  return (
    <Link href={`/opportunity/${index}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col gap-3 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge tone={TYPE_TONE[op.type] ?? "muted"}>{op.type_label}</Badge>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {op.origin}→{op.dest}
                {op.depart_date && (
                  <>
                    {" · "}
                    {op.depart_date} {weekday(op.depart_date)}
                  </>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="tnum text-xl font-semibold">
                {fmtPrice(op.alt_price, op.currency)}
              </p>
              <p className="tnum text-sm font-medium text-good">
                省 {fmtPrice(op.saving, op.currency)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <RecommendationStars count={op.stars} action={op.action} />
            <RiskBadges tags={op.risk_tags} hardBlock={op.hard_block} />
          </div>

          <ExplainBlock explain={op.explain} currency={op.currency} />
        </CardContent>
      </Card>
    </Link>
  );
}
