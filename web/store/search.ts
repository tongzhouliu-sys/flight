import { create } from "zustand";
import { api } from "@/lib/api";
import { addHistory } from "@/lib/history";
import type { SearchParams, SearchResponse } from "@/types";

type Status = "idle" | "loading" | "success" | "error";

// 结果暂存 sessionStorage：详情页刷新可存活；仅优化，非数据源。
const SESSION_KEY = "fareradar:last-search";

interface SearchState {
  params: SearchParams | null;
  response: SearchResponse | null;
  status: Status;
  error: string | null;
  replay: SearchParams | null; // 历史「重新查询」时回填首页表单
  runSearch: (params: SearchParams) => Promise<void>;
  hydrate: () => void;
  reset: () => void;
  setReplay: (params: SearchParams | null) => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  params: null,
  response: null,
  status: "idle",
  error: null,
  replay: null,

  async runSearch(params) {
    set({ status: "loading", error: null, params, response: null });
    try {
      const response = await api.search(params);
      set({ response, status: "success" });
      addHistory(params);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ params, response }));
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "搜索失败";
      set({ status: "error", error: message });
    }
  },

  hydrate() {
    if (get().response || typeof window === "undefined") return;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    try {
      const { params, response } = JSON.parse(raw) as {
        params: SearchParams;
        response: SearchResponse;
      };
      set({ params, response, status: "success" });
    } catch {
      /* 忽略损坏的缓存 */
    }
  },

  reset() {
    set({ params: null, response: null, status: "idle", error: null });
    if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_KEY);
  },

  setReplay(params) {
    set({ replay: params });
  },
}));
