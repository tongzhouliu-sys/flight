"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { History, Plane, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const LINKS = [
  { href: "/", label: "搜索", icon: Search },
  { href: "/results", label: "结果", icon: Sparkles },
  { href: "/history", label: "历史", icon: History },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Plane className="h-4 w-4" />
          </span>
          <span className="tracking-tight">FareRadar</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors sm:px-3",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{l.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            实时机票省钱雷达
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
