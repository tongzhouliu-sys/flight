import { Flame, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { LEVEL_META, type LevelIcon, type PriceLevel } from "@/lib/price-level";
import { cn } from "@/lib/utils";

const ICONS: Record<LevelIcon, typeof Flame> = {
  flame: Flame,
  "trending-down": TrendingDown,
  minus: Minus,
  "trending-up": TrendingUp,
};

/**
 * 价格水位徽章（Task 4）：颜色 + 图标 + 中文，一眼传达贵/便宜。
 * 悬停显示英文说明（Task 3）。solid 用于最需要强信号的场景（如超值）。
 */
export function PriceLevelBadge({
  level,
  size = "md",
  className,
}: {
  level: PriceLevel;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = LEVEL_META[level];
  const Icon = ICONS[meta.icon];
  const solid = level === "great" || level === "high";
  return (
    <Tooltip label={meta.en}>
      <Badge
        tone={meta.tone}
        solid={solid}
        className={cn(size === "sm" ? "text-[11px]" : "text-xs", className)}
      >
        <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />
        {meta.zh}
      </Badge>
    </Tooltip>
  );
}
