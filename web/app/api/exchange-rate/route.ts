// 汇率 API：服务端代理，缓存 1 小时。
// 前端调用 /api/exchange-rate?from=SGD&to=CNY 获取实时汇率。
import { NextRequest } from "next/server";

interface CacheEntry {
  rate: number;
  fetchedAt: number;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 小时缓存

// 多个免费汇率 API 源，依次降级
const SOURCES = [
  (from: string, to: string) =>
    fetch(`https://open.er-api.com/v6/latest/${from}`)
      .then((r) => r.json())
      .then((d) => d?.rates?.[to] ?? null),
  (from: string, to: string) =>
    fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`,
    )
      .then((r) => r.json())
      .then((d) => d?.[from.toLowerCase()]?.[to.toLowerCase()] ?? null),
];

// 兜底固定汇率（仅当所有 API 均不可用时使用）
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  SGD: { CNY: 5.3, USD: 0.75, HKD: 5.85, EUR: 0.68 },
  USD: { CNY: 7.25, SGD: 1.33, HKD: 7.8, EUR: 0.92 },
  HKD: { CNY: 0.93, SGD: 0.17, USD: 0.13, EUR: 0.12 },
  EUR: { CNY: 7.88, SGD: 1.47, USD: 1.09, HKD: 8.48 },
};

async function fetchRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;

  const key = `${from}:${to}`;
  const cached = CACHE.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.rate;
  }

  for (const source of SOURCES) {
    try {
      const rate = await source(from, to);
      if (rate && typeof rate === "number" && rate > 0) {
        CACHE.set(key, { rate, fetchedAt: Date.now() });
        return rate;
      }
    } catch {
      // 该源失败，尝试下一个
    }
  }

  // 所有 API 失败，使用兜底汇率
  const fallback = FALLBACK_RATES[from]?.[to];
  if (fallback) return fallback;

  throw new Error(`无法获取 ${from} → ${to} 汇率`);
}

export async function GET(req: NextRequest) {
  const from = (req.nextUrl.searchParams.get("from") ?? "SGD").toUpperCase();
  const to = (req.nextUrl.searchParams.get("to") ?? "CNY").toUpperCase();

  try {
    const rate = await fetchRate(from, to);
    return Response.json(
      { from, to, rate, ts: new Date().toISOString() },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "汇率获取失败" },
      { status: 502 },
    );
  }
}
