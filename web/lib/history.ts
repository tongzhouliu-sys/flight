import type { HistoryEntry, SearchParams } from "@/types";
import { CABINS, DATE_MODES, TRIP_TYPES } from "@/lib/constants";

const KEY = "fareradar:history";
const MAX = 20;

export function getHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addHistory(params: SearchParams): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const sig = signature(params);
  const kept = getHistory().filter((e) => signature(e.params) !== sig);
  const entry: HistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    params,
    at: Date.now(),
    label: describe(params),
  };
  const next = [entry, ...kept].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function removeHistory(id: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  const next = getHistory().filter((e) => e.id !== id);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

function signature(p: SearchParams): string {
  return JSON.stringify(p);
}

export function describe(p: SearchParams): string {
  const trip = TRIP_TYPES.find((t) => t.value === p.trip_type)?.label ?? p.trip_type;
  const cabin = CABINS.find((c) => c.value === p.cabin)?.label ?? p.cabin;
  const mode = DATE_MODES.find((m) => m.value === p.date_mode)?.label ?? p.date_mode;
  const date = p.depart_date ?? "灵活";
  return `${p.origin}→${p.dest} · ${date} · ${trip} · ${cabin} · ${mode}`;
}
