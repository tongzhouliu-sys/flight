"use client";

import { useEffect, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { currencySymbol } from "@/lib/format";
import type { CalendarResult } from "@/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
);

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export function PriceChart({
  results,
  currency,
}: {
  results: CalendarResult[];
  currency: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Canvas 仅客户端渲染，颜色随主题从 CSS 变量读取
  if (!mounted) return <div className="h-64 w-full" />;

  const sorted = [...results].sort((a, b) =>
    a.depart_date.localeCompare(b.depart_date),
  );
  const line = cssVar("--primary", "#1a73e8");
  const grid = "rgba(128,128,128,0.15)";
  const tick = cssVar("--muted-foreground", "#6b7280");
  const sym = currencySymbol(currency);

  const data = {
    labels: sorted.map((r) => r.depart_date.slice(5)),
    datasets: [
      {
        data: sorted.map((r) => r.price),
        borderColor: line,
        backgroundColor: "rgba(26,115,232,0.10)",
        fill: true,
        tension: 0.3,
        pointRadius: sorted.length > 30 ? 0 : 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) =>
            `${sym}${Math.round(Number(ctx.parsed.y ?? 0)).toLocaleString("en-US")}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: tick, maxRotation: 0 } },
      y: {
        grid: { color: grid },
        ticks: {
          color: tick,
          callback: (v) => `${sym}${Number(v).toLocaleString("en-US")}`,
        },
      },
    },
  };

  return (
    <div className="h-64 w-full">
      <Line data={data} options={options} />
    </div>
  );
}
