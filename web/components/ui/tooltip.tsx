import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 纯 CSS Hover/Focus 气泡提示（零依赖）。
 * 用于「说人话」：中文主体 + 悬停显示英文术语或补充说明。
 * 放置于非 overflow-hidden 容器中；表格等裁剪区改用原生 title。
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-pop transition-opacity duration-150",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}
