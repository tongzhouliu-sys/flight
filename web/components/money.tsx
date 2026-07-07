import { Tooltip } from "@/components/ui/tooltip";
import { currencyName, fmtPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/lib/currency";

/**
 * 主价格展示：始终换算为人民币（CNY）展示，悬浮提示中说明原币种及汇率。
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
  const rate = useCurrencyStore((s) => s.rate);
  const formattedTooltip = currency === "SGD"
    ? `${currencyName(currency)} (已按 ${rate.toFixed(4)} 汇率换算为人民币)`
    : currencyName(currency);

  return (
    <Tooltip label={formattedTooltip}>
      <span className={cn("tnum", className)}>{fmtPrice(value, currency)}</span>
    </Tooltip>
  );
}
