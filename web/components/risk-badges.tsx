import { AlertTriangle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { RISK_TAG_LABELS, RISK_TAG_TERMS } from "@/lib/constants";

/**
 * 注意事项 / 风险提示（Task 3）：中文说明 + 英文术语悬停。
 * hard_block → 「不建议购买」。无标签 → 「无明显风险」。
 */
export function RiskBadges({
  tags,
  hardBlock,
}: {
  tags: string[];
  hardBlock: boolean;
}) {
  if (hardBlock)
    return (
      <Tooltip label="Hard Block">
        <Badge tone="bad" solid>
          <AlertTriangle className="h-3.5 w-3.5" />
          不建议购买
        </Badge>
      </Tooltip>
    );
  if (tags.length === 0)
    return (
      <Badge tone="good">
        <ShieldCheck className="h-3.5 w-3.5" />
        无明显风险
      </Badge>
    );
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <Tooltip key={t} label={RISK_TAG_TERMS[t] ?? t}>
          <Badge tone={t === "low_confidence_baseline" ? "warn" : "muted"}>
            {RISK_TAG_LABELS[t] ?? t}
          </Badge>
        </Tooltip>
      ))}
    </div>
  );
}
