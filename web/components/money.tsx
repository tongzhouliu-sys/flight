import { Tooltip } from "@/components/ui/tooltip";
import { currencyName, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * 主价格展示（Task 2）：始终使用后端原币种（当前数据源为 SGD），
 * 不做汇率换算、不混排币种；悬停显示完整原币种信息。
 */
export function Money({
  value,
  currency,
  className,
}: {
  value: number | null | undefined;
  currency: string;
  className?: string;
}) {
  return (
    <Tooltip label={currencyName(currency)}>
      <span className={cn("tnum", className)}>{fmtPrice(value, currency)}</span>
    </Tooltip>
  );
}
