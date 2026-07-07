import { Badge } from "@/components/ui/badge";
import { RISK_TAG_LABELS } from "@/lib/constants";

export function RiskBadges({
  tags,
  hardBlock,
}: {
  tags: string[];
  hardBlock: boolean;
}) {
  if (hardBlock) return <Badge tone="bad">硬性阻断</Badge>;
  if (tags.length === 0) return <Badge tone="good">无风险标签</Badge>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Badge key={t} tone={t === "low_confidence_baseline" ? "warn" : "muted"}>
          {RISK_TAG_LABELS[t] ?? t}
        </Badge>
      ))}
    </div>
  );
}
