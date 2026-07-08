import type { Cabin, DateMode, TripType } from "@/types";

export const CABINS: { value: Cabin; label: string }[] = [
  { value: "ECONOMY", label: "经济舱" },
  { value: "PREMIUM_ECONOMY", label: "超级经济舱" },
  { value: "BUSINESS", label: "商务舱" },
  { value: "FIRST", label: "头等舱" },
];

export const TRIP_TYPES: { value: TripType; label: string }[] = [
  { value: "one_way", label: "单程" },
  { value: "round_trip", label: "往返" },
];

export const DATE_MODES: { value: DateMode; label: string; hint: string }[] = [
  { value: "exact", label: "精确日期", hint: "仅出发当天" },
  { value: "flex3", label: "±3 天", hint: "出发日前后 3 天" },
  { value: "next7", label: "未来 7 天", hint: "从今天起 7 天" },
  { value: "next30", label: "未来 30 天", hint: "从今天起 30 天" },
  { value: "next60", label: "未来 2 个月", hint: "从今天起 60 天" },
];

// ─────────────────────────────────────────────────────────────────────────
// Task 3「说人话」：把后端英文/术语字段翻成普通用户能懂的中文，英文仅作悬停辅助。
// 这些都是展示层映射，不改变后端返回的 type / action 原值。
// ─────────────────────────────────────────────────────────────────────────

// 机会类型：友好中文标签（覆盖后端 type_label 展示）+ 英文术语（悬停）+ 一句话说明。
export const OPPORTUNITY_META: Record<
  string,
  { zh: string; en: string; tagline: string }
> = {
  baseline_breach: {
    zh: "跌破常态价",
    en: "Baseline Breach",
    tagline: "当前价格已低于这条航线的历史常态水平",
  },
  date_shift: {
    zh: "换个日期更便宜",
    en: "Date Shift",
    tagline: "在你选的日期附近，换一天出发能省更多",
  },
  nearby_airport: {
    zh: "邻近机场更划算",
    en: "Nearby Airport",
    tagline: "从附近机场出发/到达（已含接驳成本）反而更便宜",
  },
  self_transfer: {
    zh: "分开出票",
    en: "Self-transfer / Nested Ticket",
    tagline: "拆成两段分别购票，总价更低（需自理转机与行李）",
  },
};

export function oppMeta(type: string, fallbackLabel?: string) {
  return (
    OPPORTUNITY_META[type] ?? {
      zh: fallbackLabel ?? type,
      en: type,
      tagline: "",
    }
  );
}

// 建议档：后端返回「立即买 / 关注」→ 友好中文 + 英文术语 + 语义色。
export const ACTION_META: Record<
  string,
  { zh: string; en: string; tone: "good" | "info" }
> = {
  立即买: { zh: "建议立即购买", en: "Buy Now", tone: "good" },
  关注: { zh: "建议继续关注", en: "Monitor", tone: "info" },
};

export function actionMeta(action: string) {
  return ACTION_META[action] ?? { zh: action, en: action, tone: "info" as const };
}

// 风险标签中文说明（与后端 app/signals/risk.py 枚举一致）
export const RISK_TAG_LABELS: Record<string, string> = {
  two_ticket: "两张票（分开出票）",
  border_crossing: "跨境接驳",
  lcc_baggage: "廉航托运行李费",
  overnight_layover: "过夜中转",
  short_layover: "短接驳（240–300 分钟）",
  low_confidence_baseline: "参考价样本偏少",
};

// 风险标签对应英文术语（悬停辅助）
export const RISK_TAG_TERMS: Record<string, string> = {
  two_ticket: "Two separate tickets",
  border_crossing: "Border crossing / self-connect",
  lcc_baggage: "LCC checked-baggage fee",
  overnight_layover: "Overnight layover",
  short_layover: "Short layover (240–300 min)",
  low_confidence_baseline: "Low-confidence baseline",
};

// 机会类型 → 语义色调（用于卡片强调）
export const TYPE_TONE: Record<string, "good" | "info" | "warn" | "muted"> = {
  baseline_breach: "good",
  date_shift: "info",
  nearby_airport: "warn",
  self_transfer: "muted",
};
