import type {
  Opportunity,
  RouteInfo,
  SearchParams,
  SearchResponse,
} from "@/types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`/api${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, "无法连接服务，请检查后端是否在运行");
  }

  const ct = resp.headers.get("content-type") ?? "";
  const payload = ct.includes("application/json")
    ? await resp.json().catch(() => null)
    : await resp.text().catch(() => "");

  if (!resp.ok) {
    const detail =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : typeof payload === "string" && payload
          ? payload
          : `请求失败（${resp.status}）`;
    throw new ApiError(resp.status, detail);
  }
  return payload as T;
}

export const api = {
  search: (body: SearchParams) =>
    request<SearchResponse>("/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  routes: () => request<{ routes: RouteInfo[] }>("/routes"),
};

export type { Opportunity };
