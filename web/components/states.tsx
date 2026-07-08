"use client";

import { type ReactNode, useEffect, useState } from "react";
import { AlertTriangle, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Loading({ label = "加载中…" }: { label?: string }) {
  const [msgIndex, setMsgIndex] = useState(0);

  const defaultMessages = [
    label,
    "正在智能检索全网实时运价与舱位...",
    "正在对比历史价格曲线与百分位数...",
    "正在计算燃油与机场税费最优组合...",
    "正在为您生成专属省钱雷达报告...",
  ];

  const messages = label === "加载中…" 
    ? [
        "正在加载数据...",
        "正在智能检索实时运价...",
        "正在对比历史价格走势...",
        "正在为您生成省钱方案...",
      ]
    : defaultMessages;

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 w-full min-h-[450px]">
      {/* Visual Animation Container */}
      <div className="relative w-full max-w-[420px] h-[220px] rounded-2xl bg-gradient-to-b from-blue-50/40 to-white/10 dark:from-blue-950/20 dark:to-transparent border border-blue-100/50 dark:border-blue-950/30 overflow-hidden shadow-sm flex items-center justify-center">
        
        {/* Floating Clouds in Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
          {/* Cloud 1 */}
          <svg className="absolute w-24 h-12 text-blue-200/30 dark:text-blue-500/10 top-[15%] left-0 animate-cloud-drift-slow" viewBox="0 0 100 50" fill="currentColor">
            <path d="M10 40a15 15 0 0 1 10-27 20 20 0 0 1 37-3 15 15 0 0 1 23 5 15 15 0 0 1 10 15 15 15 0 0 1-15 15H20a15 15 0 0 1-10-15z" />
          </svg>
          {/* Cloud 2 */}
          <svg className="absolute w-16 h-8 text-blue-200/20 dark:text-blue-500/5 top-[65%] left-0 animate-cloud-drift-fast" viewBox="0 0 100 50" fill="currentColor">
            <path d="M10 40a15 15 0 0 1 10-27 20 20 0 0 1 37-3 15 15 0 0 1 23 5 15 15 0 0 1 10 15 15 15 0 0 1-15 15H20a15 15 0 0 1-10-15z" />
          </svg>
          {/* Cloud 3 */}
          <svg className="absolute w-20 h-10 text-blue-200/25 dark:text-blue-500/8 top-[40%] left-0 animate-cloud-drift-medium" viewBox="0 0 100 50" fill="currentColor">
            <path d="M10 40a15 15 0 0 1 10-27 20 20 0 0 1 37-3 15 15 0 0 1 23 5 15 15 0 0 1 10 15 15 15 0 0 1-15 15H20a15 15 0 0 1-10-15z" />
          </svg>
        </div>

        {/* Dynamic Wind Trails (High Speed Flow) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Wind line 1 */}
          <div className="absolute top-[25%] left-0 w-32 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-400/20 to-transparent animate-wind-flow-1" />
          {/* Wind line 2 */}
          <div className="absolute top-[50%] left-0 w-40 h-[1.5px] bg-gradient-to-r from-transparent via-blue-300/40 dark:via-blue-500/25 to-transparent animate-wind-flow-2" />
          {/* Wind line 3 */}
          <div className="absolute top-[75%] left-0 w-28 h-[1.5px] bg-gradient-to-r from-transparent via-blue-400/30 dark:via-blue-400/20 to-transparent animate-wind-flow-3" />
        </div>

        {/* Floating, Tilted Airplane Container */}
        <div className="relative animate-plane-fly z-10 flex items-center justify-center">
          {/* Radial Outer Glow */}
          <div className="absolute w-36 h-36 rounded-full bg-blue-400/10 dark:bg-blue-500/5 blur-2xl pointer-events-none" />
          
          {/* Sleek Commercial Jet SVG */}
          <svg className="w-40 h-20 drop-shadow-[0_12px_24px_rgba(37,99,235,0.18)] dark:drop-shadow-[0_12px_24px_rgba(59,130,246,0.3)]" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="planeBodyGrad" x1="0" y1="0" x2="120" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="60%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="wingGrad" x1="45" y1="57" x2="78" y2="34" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1d4ed8" />
                <stop offset="50%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#60a5fa" />
              </linearGradient>
              <linearGradient id="backWingGrad" x1="40" y1="22" x2="70" y2="3" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1e40af" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
            
            {/* Back Wing (Far Side) */}
            <path d="M 60 22 L 40 3 L 48 3 L 70 22 Z" fill="url(#backWingGrad)" opacity="0.8" />
            
            {/* Tail Fin */}
            <path d="M 22 25 L 10 5 L 18 5 L 30 26 Z" fill="url(#backWingGrad)" />
            
            {/* Engine 1 (Far Side, subtle) */}
            <rect x="52" y="20" width="14" height="4" rx="2" fill="#1e293b" opacity="0.6" />

            {/* Fuselage (Sleek aerodynamic body) */}
            <path d="M 15 28 C 15 20, 45 18, 85 18 C 105 18, 118 22, 120 28 C 118 34, 105 38, 85 38 C 45 38, 15 36, 15 28 Z" fill="url(#planeBodyGrad)" />
            
            {/* Engine 2 (Near Side) */}
            <rect x="56" y="36" width="16" height="5" rx="2.5" fill="#0f172a" />
            
            {/* Front Wing (Near Side, crisp overlap) */}
            <path d="M 65 33 L 45 57 L 56 57 L 78 33 Z" fill="url(#wingGrad)" />
            
            {/* Cockpit Window (sleek futuristic glass) */}
            <path d="M 108 24 C 112 24, 115 25, 116 27 C 112 27, 110 26, 108 24 Z" fill="#e0f2fe" opacity="0.9" />
          </svg>
        </div>
      </div>

      {/* Rotating Loading Messages with Fade-In Animation */}
      <div className="mt-8 text-center min-h-[50px] flex flex-col items-center justify-center">
        <p 
          key={msgIndex} 
          className="text-sm font-medium text-foreground/80 dark:text-foreground/75 tracking-wide animate-[fadeIn_0.5s_ease-out] flex items-center gap-2"
        >
          {/* Small modern dot indicator pulsing */}
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {messages[msgIndex]}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1.5">
          实时多源比价，为您挖掘隐藏优惠
        </p>
      </div>
    </div>
  );
}


export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-bad/30 bg-bad/5 px-6 py-12 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-bad/15 text-bad">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-bad">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
