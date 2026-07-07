"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

type Theme = "light" | "dark";

// 读取当前生效主题（含系统偏好回退）；仅客户端调用
function currentTheme(): Theme {
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(currentTheme());
  }, []);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("fareradar:theme", next);
    } catch {
      /* 隐私模式下 localStorage 不可用：主题仅本次会话生效 */
    }
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <Tooltip label={isDark ? "切换到浅色 · Light" : "切换到深色 · Dark"}>
      <button
        type="button"
        onClick={toggle}
        aria-label="切换主题"
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {/* 未挂载前渲染占位，避免 hydration 抖动 */}
        {theme == null ? (
          <span className="h-4 w-4" />
        ) : isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
    </Tooltip>
  );
}
