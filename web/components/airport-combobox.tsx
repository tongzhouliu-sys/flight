"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAirport, searchAirports } from "@/lib/airports";
import type { AirportInfo } from "@/lib/airports";

interface Props {
  id?: string;
  value: string; // 当前 IATA 代码
  onChange: (code: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * 机场选择器（自动补全）。
 *
 * - 支持输入 IATA 代码、中文城市名、英文城市名进行模糊搜索
 * - 选择后写入 IATA 代码，并在输入框下方展示机场名 + 城市
 * - 支持键盘上下键导航 + 回车选择 + ESC 关闭
 */
export function AirportCombobox({
  id,
  value,
  onChange,
  placeholder = "输入城市或机场代码",
  className,
}: Props) {
  const [input, setInput] = useState(value);
  const [results, setResults] = useState<AirportInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [prevValue, setPrevValue] = useState(value);

  // 当外部 value 变化（如从历史填充）时同步输入框
  if (value !== prevValue) {
    setInput(value);
    setPrevValue(value);
  }

  const doSearch = useCallback((q: string) => {
    const hits = searchAirports(q);
    setResults(hits);
    setOpen(hits.length > 0);
    setActiveIdx(-1);
  }, []);

  function handleChange(raw: string) {
    const v = raw.toUpperCase();
    setInput(v);
    onChange(v); // 实时同步，让表单验证可以工作
    if (v.length > 0) {
      doSearch(v);
    } else {
      setResults([]);
      setOpen(false);
    }
  }

  function pick(airport: AirportInfo) {
    setInput(airport.code);
    onChange(airport.code);
    setOpen(false);
    setResults([]);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (activeIdx >= 0 && activeIdx < results.length) {
          pick(results[activeIdx]);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  // 点击外部关闭下拉
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const selected = getAirport(value);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={input}
        placeholder={placeholder}
        onFocus={() => {
          if (input.length > 0) doSearch(input);
        }}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-9 w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm shadow-sm outline-none transition-colors",
          "placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30",
          "uppercase",
        )}
      />

      {/* 已选机场的城市 / 机场名提示 */}
      {selected && !open && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          {selected.name}（{selected.city}）
        </p>
      )}

      {/* 下拉列表 */}
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className={cn(
            "absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border border-border bg-card shadow-lg",
            "py-1 text-sm",
          )}
        >
          {results.map((a, i) => (
            <li
              key={a.code}
              role="option"
              aria-selected={i === activeIdx}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={(e) => {
                e.preventDefault(); // 阻止 blur
                pick(a);
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 px-3 py-2 transition-colors",
                i === activeIdx
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span className="w-10 shrink-0 font-mono font-semibold text-foreground">
                {a.code}
              </span>
              <span className="min-w-0 truncate">
                {a.name}
                <span className="ml-1 text-muted-foreground/70">（{a.city}）</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
