import { Plane } from "lucide-react";
import { airportCity } from "@/lib/airports";
import { cn } from "@/lib/utils";

interface Props {
  origin: string;
  dest: string;
  /** "lg" = 页面标题级（大号）, "sm" = 卡片/行内级（紧凑） */
  size?: "lg" | "sm";
  className?: string;
}

/**
 * 统一航线展示组件。
 *
 * 大号：SIN → HKG（下方附城市名）
 * 小号：SIN 新加坡 → HKG 香港（行内）
 */
export function RouteLabel({ origin, dest, size = "sm", className }: Props) {
  const oc = airportCity(origin);
  const dc = airportCity(dest);

  if (size === "lg") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <span className="text-2xl font-semibold tracking-tight">
          {origin} → {dest}
        </span>
        {(oc || dc) && (
          <span className="text-sm text-muted-foreground">
            {oc || origin} → {dc || dest}
          </span>
        )}
      </div>
    );
  }

  // size === "sm"
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <Plane className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-medium text-foreground">
        {origin}
        {oc && (
          <span className="ml-0.5 text-muted-foreground font-normal text-xs">
            {oc}
          </span>
        )}
        {" → "}
        {dest}
        {dc && (
          <span className="ml-0.5 text-muted-foreground font-normal text-xs">
            {dc}
          </span>
        )}
      </span>
    </span>
  );
}
