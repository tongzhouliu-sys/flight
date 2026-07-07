import { fmtPrice } from "@/lib/format";
import { windowPosition } from "@/lib/price-level";
import { cn } from "@/lib/utils";

/**
 * 价格标尺（Task 4）：低价→高价的渐变轨道 + 当前价标记，
 * 让「现在贵不贵」在视觉上一目了然。可选参考价（P50）刻度。
 * 仅用后端已有的 window_low / 窗口价格 / P50，不做任何换算。
 */
export function PriceMeter({
  value,
  min,
  max,
  mid,
  currency,
  className,
}: {
  value: number;
  min: number;
  max: number;
  mid?: number | null;
  currency: string;
  className?: string;
}) {
  const pos = windowPosition(value, min, max);
  const midPos = mid != null ? windowPosition(mid, min, max) : null;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative h-2 w-full rounded-full">
        <div
          className="absolute inset-0 rounded-full opacity-80"
          style={{
            background:
              "linear-gradient(90deg, var(--good) 0%, var(--warn) 58%, var(--bad) 100%)",
          }}
        />
        {/* 参考价（P50）刻度 */}
        {midPos != null && (
          <span
            className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-foreground/40"
            style={{ left: `${midPos * 100}%` }}
            aria-hidden
          />
        )}
        {/* 当前价标记 */}
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-foreground shadow-pop"
          style={{ left: `${pos * 100}%` }}
          aria-hidden
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground tnum">
        <span>低 {fmtPrice(min, currency)}</span>
        {mid != null && <span>参考价 {fmtPrice(mid, currency)}</span>}
        <span>高 {fmtPrice(max, currency)}</span>
      </div>
    </div>
  );
}
