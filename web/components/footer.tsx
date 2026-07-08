import { Plane } from "lucide-react";

export function Footer() {
  return (
    <footer className="w-full border-t border-border/80 bg-background/50 backdrop-blur-md mt-auto">
      <div className="mx-auto max-w-5xl px-4 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-primary to-info text-white shadow-sm">
            <Plane className="h-3 w-3 -rotate-45" />
          </span>
          <span className="tracking-tight text-foreground font-bold">FareRadar</span>
          <span className="text-muted-foreground/60">|</span>
          <span>实时机票省钱雷达</span>
        </div>
        <div className="text-center sm:text-right">
          <span>© {new Date().getFullYear()} FareRadar. 所有搜索历史与设置均安全保存在您的本地浏览器中。</span>
        </div>
      </div>
    </footer>
  );
}
