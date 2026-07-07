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
];

// 风险标签中文说明（与后端 app/signals/risk.py 枚举一致）
export const RISK_TAG_LABELS: Record<string, string> = {
  two_ticket: "两张票（分开出票）",
  border_crossing: "跨境接驳",
  lcc_baggage: "廉航托运行李费",
  overnight_layover: "过夜中转",
  short_layover: "短接驳（240–300 分钟）",
  low_confidence_baseline: "低置信度基线",
};

// 机会类型 → 语义色调（用于卡片强调）
export const TYPE_TONE: Record<string, "good" | "info" | "warn" | "muted"> = {
  baseline_breach: "good",
  date_shift: "info",
  nearby_airport: "warn",
  self_transfer: "muted",
};

export const ACTION_TONE: Record<string, "good" | "info"> = {
  立即买: "good",
  关注: "info",
};
