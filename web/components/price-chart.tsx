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
import { currencySymbol, weekday } from "@/lib/format";
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
  selectedDate,
  onSelectDate,
}: {
  results: CalendarResult[];
  currency: string;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Canvas 仅客户端渲染，颜色随主题从 CSS 变量读取
  if (!mounted) return <div className="h-64 w-full animate-pulse rounded-lg bg-muted/50" />;

  const sorted = [...results].sort((a, b) =>
    a.depart_date.localeCompare(b.depart_date),
  );
  const prices = sorted.map((r) => r.price);
  const min = Math.min(...prices);
  const line = cssVar("--primary", "#2563eb");
  const good = cssVar("--good", "#067647");
  const grid = "rgba(128,128,128,0.14)";
  const tick = cssVar("--muted-foreground", "#6b7280");
  const sym = currencySymbol(currency);

  const data = {
    labels: sorted.map((r) => r.depart_date.slice(5)),
    datasets: [
      {
        data: prices,
        borderColor: line,
        backgroundColor: "rgba(37,99,235,0.08)",
        fill: true,
        tension: 0.3,
        borderWidth: 2,
        // 最低价点：绿色放大；选中点：红色放大，便于一眼定位
        pointRadius: sorted.map((r) =>
          r.depart_date === selectedDate ? 7 : (r.price === min ? 5 : sorted.length > 30 ? 0 : 2.5),
        ),
        pointHoverRadius: 7,
        pointBackgroundColor: sorted.map((r) =>
          r.depart_date === selectedDate ? "#ff4d4f" : (r.price === min ? good : line),
        ),
        pointBorderColor: sorted.map((r) => (r.depart_date === selectedDate ? "#ff4d4f" : r.price === min ? good : line)),
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event, elements) => {
      if (elements && elements.length > 0) {
        const index = elements[0].index;
        const clickedDate = sorted[index].depart_date;
        onSelectDate?.(clickedDate);
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => {
            const r = sorted[items[0].dataIndex];
            return `${r.depart_date} ${weekday(r.depart_date)}`;
          },
          label: (ctx) => {
            const price = Math.round(Number(ctx.parsed.y ?? 0)).toLocaleString(
              "en-US",
            );
            const tag = sorted[ctx.dataIndex].price === min ? "（最低）" : "";
            return `${sym}${price}${tag}`;
          },
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
    <div className="h-full w-full">
      <Line data={data} options={options} />
    </div>
  );
}
