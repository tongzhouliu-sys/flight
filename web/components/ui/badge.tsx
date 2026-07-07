import * as React from "react";
import { cn } from "@/lib/utils";

type Tone = "good" | "warn" | "bad" | "info" | "muted";

const SOFT: Record<Tone, string> = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  info: "bg-info/15 text-info",
  muted: "bg-muted text-muted-foreground",
};

// 实心徽章：用于最需要「一眼看到」的价格信号（超值 / 偏高）
const SOLID: Record<Tone, string> = {
  good: "bg-good text-white",
  warn: "bg-warn text-white",
  bad: "bg-bad text-white",
  info: "bg-info text-white",
  muted: "bg-muted-foreground text-background",
};

export function Badge({
  tone = "muted",
  solid = false,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  solid?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        (solid ? SOLID : SOFT)[tone],
        className,
      )}
      {...props}
    />
  );
}
