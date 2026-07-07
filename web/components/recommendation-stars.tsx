import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { actionMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * 推荐档展示：1–4★ + 建议动作（Task 3 友好中文 + 英文悬停）。
 * 回答「推荐买吗」。
 */
export function RecommendationStars({
  count,
  action,
  showAction = true,
}: {
  count: number;
  action: string;
  showAction?: boolean;
}) {
  const meta = actionMeta(action);
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center gap-0.5"
        aria-label={`推荐 ${count} 星（满分 4）`}
      >
        {[0, 1, 2, 3].map((i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < count
                ? "fill-warn text-warn"
                : "fill-transparent text-muted-foreground/35",
            )}
          />
        ))}
      </span>
      {showAction && (
        <Tooltip label={meta.en}>
          <Badge tone={meta.tone} solid={meta.tone === "good"}>
            {meta.zh}
          </Badge>
        </Tooltip>
      )}
    </div>
  );
}
