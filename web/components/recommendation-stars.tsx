import { Badge } from "@/components/ui/badge";
import { ACTION_TONE } from "@/lib/constants";
import { stars as starStr } from "@/lib/format";

export function RecommendationStars({
  count,
  action,
}: {
  count: number;
  action: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-warn" aria-label={`推荐 ${count} 星`}>
        {starStr(count)}
      </span>
      <Badge tone={ACTION_TONE[action] ?? "info"}>{action}</Badge>
    </div>
  );
}
