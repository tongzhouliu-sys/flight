// Task 4 价格水位（Price Level）：纯展示层派生，不新增后端字段、不做汇率换算。
// 输入均为后端已返回的数据：机会的 percentile_now（历史/窗口分位）或
// 一组价格的窗口相对位置。目标是让用户 5 秒判断「现在买贵不贵」。

export type PriceLevel = "great" | "good" | "normal" | "high";

export type LevelIcon = "flame" | "trending-down" | "minus" | "trending-up";

export interface LevelMeta {
  zh: string;
  en: string;
  tone: "good" | "warn" | "bad";
  icon: LevelIcon;
  /** 圆点/进度条填充色（语义 token）。 */
  dot: string;
}

export const LEVEL_META: Record<PriceLevel, LevelMeta> = {
  great: {
    zh: "捡到宝了",
    en: "Great deal · well below typical",
    tone: "good",
    icon: "flame",
    dot: "bg-good",
  },
  good: {
    zh: "比平时便宜",
    en: "Below typical price",
    tone: "good",
    icon: "trending-down",
    dot: "bg-good",
  },
  normal: {
    zh: "和往常差不多",
    en: "Typical price",
    tone: "warn",
    icon: "minus",
    dot: "bg-warn",
  },
  high: {
    zh: "现在买有点贵",
    en: "Above typical price",
    tone: "bad",
    icon: "trending-up",
    dot: "bg-bad",
  },
};

/** 历史/窗口分位（percentile_now，越低越便宜）→ 价格水位。 */
export function levelFromPercentile(pct: number | null | undefined): PriceLevel | null {
  if (pct == null) return null;
  if (pct <= 15) return "great";
  if (pct <= 45) return "good";
  if (pct <= 70) return "normal";
  return "high";
}

/** 一组价格中某价的相对位置（min→max）→ 价格水位。窗口无价差时返回 null。 */
export function levelFromWindow(
  price: number,
  min: number,
  max: number,
): PriceLevel | null {
  if (!(max > min)) return null;
  const pos = (price - min) / (max - min);
  if (pos <= 0.12) return "great";
  if (pos <= 0.45) return "good";
  if (pos <= 0.78) return "normal";
  return "high";
}

/** 归一化位置 0–1（用于价格标尺 marker）。 */
export function windowPosition(price: number, min: number, max: number): number {
  if (!(max > min)) return 0.5;
  return Math.min(1, Math.max(0, (price - min) / (max - min)));
}

/** 相对参考价的便宜幅度（%）：省了多少。base<=0 时返回 null。 */
export function discountPct(
  base: number | null | undefined,
  alt: number | null | undefined,
): number | null {
  if (base == null || alt == null || base <= 0) return null;
  const pct = Math.round((100 * (base - alt)) / base);
  return pct > 0 ? pct : null;
}

/**
 * 机会价格水位：优先用后端分位（percentile_now），无分位时以折扣幅度兜底。
 * 供机会卡片与结果页结论区复用。
 */
export function levelForOpportunity(
  percentile: number | null,
  base: number,
  alt: number,
): PriceLevel {
  const byPct = levelFromPercentile(percentile);
  if (byPct) return byPct;
  const disc = discountPct(base, alt) ?? 0;
  if (disc >= 25) return "great";
  if (disc >= 8) return "good";
  return "normal";
}

/** 从机会 detail 中安全读取 percentile_now。 */
export function readPercentile(detail: Record<string, unknown> | undefined): number | null {
  const raw = detail?.["percentile_now"];
  return typeof raw === "number" ? raw : null;
}
