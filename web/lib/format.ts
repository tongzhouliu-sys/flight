const SYMBOLS: Record<string, string> = {
  SGD: "S$",
  USD: "$",
  CNY: "¥",
  HKD: "HK$",
  EUR: "€",
};

// 币种全称（悬停辅助展示「完整原币种信息」）。数据源为单一原币种，前端不做汇率换算。
const NAMES: Record<string, string> = {
  SGD: "新加坡元 · SGD",
  USD: "美元 · USD",
  CNY: "人民币 · CNY",
  HKD: "港元 · HKD",
  EUR: "欧元 · EUR",
};

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? `${currency} `;
}

export function currencyName(currency: string): string {
  return NAMES[currency] ?? currency;
}

let globalRate = 5.3;

export function setGlobalRate(rate: number) {
  globalRate = rate;
}

export function getGlobalRate() {
  return globalRate;
}

/** 价格格式化：转换非 CNY 币种（如 SGD）为 CNY 并以 ¥ 展示 */
export function fmtPrice(value: number | null | undefined, currency = "SGD"): string {
  if (value == null) return "—";
  if (currency === "SGD") {
    const converted = value * globalRate;
    return `¥${Math.round(converted).toLocaleString("en-US")}`;
  }
  if (currency === "CNY") {
    return `¥${Math.round(value).toLocaleString("en-US")}`;
  }
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
