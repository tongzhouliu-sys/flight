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
import { fmtPrice, weekday } from "@/lib/format";
import { useCurrencyStore } from "@/lib/currency";
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
  // 订阅汇率以支持响应式更新
  useCurrencyStore((s) => s.rate);

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
  const grid = "rgba(128,128,128,0.08)";
  const tick = cssVar("--muted-foreground", "#6b7280");

  const data = {
    labels: sorted.map((r) => r.depart_date.slice(5)),
    datasets: [
      {
        data: prices,
        borderColor: line,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return "rgba(37,99,235,0.08)";
          const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, "rgba(37,99,235,0.15)");
          gradient.addColorStop(0.6, "rgba(37,99,235,0.05)");
          gradient.addColorStop(1, "rgba(37,99,235,0.0)");
          return gradient;
        },
        fill: true,
        tension: 0.35,
        borderWidth: 2.5,
        // 最低价点：绿色放大；选中点：红色放大，便于一眼定位
        pointRadius: sorted.map((r) =>
          r.depart_date === selectedDate ? 8 : (r.price === min ? 6 : sorted.length > 30 ? 0 : 3),
        ),
        pointHoverRadius: 8,
        pointBackgroundColor: sorted.map((r) =>
          r.depart_date === selectedDate ? "#ff4d4f" : (r.price === min ? good : line),
        ),
        pointBorderColor: sorted.map((r) =>
          r.depart_date === selectedDate ? "#fff" : (r.price === min ? "#fff" : "transparent"),
        ),
        pointBorderWidth: sorted.map((r) =>
          r.depart_date === selectedDate ? 3 : (r.price === min ? 2 : 0),
        ),
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
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(20, 23, 28, 0.88)",
        titleColor: "#e8eaed",
        bodyColor: "#e8eaed",
        borderColor: "rgba(110, 168, 254, 0.3)",
        borderWidth: 1,
        cornerRadius: 10,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        titleFont: { size: 12, weight: "bold" as const },
        bodyFont: { size: 13 },
        displayColors: false,
        callbacks: {
          title: (items) => {
            const r = sorted[items[0].dataIndex];
            return `${r.depart_date} ${weekday(r.depart_date)}`;
          },
          label: (ctx) => {
            const price = sorted[ctx.dataIndex].price;
            const tag = price === min ? " 🔥 最低" : "";
            return `${fmtPrice(price, currency)}${tag}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: tick,
          maxRotation: 0,
          font: { size: 10 },
        },
        border: { display: false },
      },
      y: {
        grid: { color: grid },
        ticks: {
          color: tick,
          font: { size: 10 },
          callback: (v) => fmtPrice(Number(v), currency),
        },
        border: { display: false },
      },
    },
  };

  return (
    <div className="h-full w-full">
      <Line data={data} options={options} />
    </div>
  );
}
