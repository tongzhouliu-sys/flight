import { create } from "zustand";
import { setGlobalRate } from "./format";

interface CurrencyState {
  rate: number; // SGD -> CNY rate, default fallback is 5.3
  isLoaded: boolean;
  isLoading: boolean;
  fetchRate: (from?: string, to?: string) => Promise<number>;
}

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  rate: 5.3,
  isLoaded: false,
  isLoading: false,
  async fetchRate(from = "SGD", to = "CNY") {
    if (get().isLoaded) return get().rate;
    if (get().isLoading) return get().rate;
    set({ isLoading: true });
    try {
      const resp = await fetch(`/api/exchange-rate?from=${from}&to=${to}`);
      if (!resp.ok) throw new Error("Fetch rate failed");
      const data = await resp.json();
      if (data && typeof data.rate === "number") {
        set({ rate: data.rate, isLoaded: true, isLoading: false });
        setGlobalRate(data.rate);
        return data.rate;
      }
    } catch (e) {
      console.warn("Using fallback rate due to error:", e);
    }
    set({ isLoading: false, isLoaded: true }); // Mark loaded even if error so we don't spam requests
    setGlobalRate(get().rate);
    return get().rate;
  },
}));
