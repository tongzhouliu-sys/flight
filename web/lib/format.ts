const SYMBOLS: Record<string, string> = {
  SGD: "S$",
  USD: "$",
  CNY: "¥",
  HKD: "HK$",
  EUR: "€",
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

/** 价格格式化：S$1,234（整数，千分位）。 */
export function fmtPrice(value: number | null | undefined, currency = "SGD"): string {
  if (value == null) return "—";
  return `${currencySymbol(currency)}${Math.round(value).toLocaleString("en-US")}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso;
}

const WEEKDAY = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function weekday(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return WEEKDAY[d.getDay()];
}

export function stopsLabel(stops: number | null | undefined): string {
  if (stops == null) return "";
  if (stops === 0) return "直飞";
  return `${stops} 次中转`;
}

export function stars(n: number): string {
  return "★".repeat(Math.max(0, n)) + "☆".repeat(Math.max(0, 4 - n));
}
