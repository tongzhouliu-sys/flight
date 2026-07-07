// 与后端 JSON 响应对齐的类型（后端返回 snake_case）。

export type TripType = "one_way" | "round_trip";
export type Cabin = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
export type DateMode = "exact" | "flex3" | "next7" | "next30";
export type OpportunityType =
  | "baseline_breach"
  | "date_shift"
  | "nearby_airport"
  | "self_transfer";

export interface SearchParams {
  origin: string;
  dest: string;
  depart_date?: string | null;
  return_date?: string | null;
  trip_type: TripType;
  cabin: Cabin;
  adults: number;
  date_mode: DateMode;
}

export interface CalendarResult {
  depart_date: string;
  return_date: string | null;
  price: number;
  currency: string;
  carrier: string | null;
  stops: number | null;
}

export interface ExplainSide {
  label: string | null;
  price: number;
}

export interface Explain {
  headline: string;
  route: string;
  from: ExplainSide;
  to: ExplainSide;
  note: string;
  text: string;
}

export interface Opportunity {
  type: OpportunityType;
  type_label: string;
  origin: string;
  dest: string;
  route_id: string;
  depart_date: string | null;
  return_date: string | null;
  base_price: number;
  alt_price: number;
  saving: number;
  currency: string;
  risk_tags: string[];
  hard_block: boolean;
  effective_total: number | null;
  baggage_fee: number | null;
  stars: number;
  action: string;
  action_color: string;
  risk_score: number | null; // 占位：后端评分模型上线后填充
  recommendation_score: number | null; // 占位：同上
  explain: Explain;
  detail: Record<string, unknown>;
  deeplink: string;
  layover_cities: string[];
  free_checked_bag: boolean;
  bag_recheck: boolean;
}

export interface SearchMeta {
  provider: string | null;
  cached: boolean;
  fetched_at: string;
  monitored_route_id: string | null;
  currency: string;
  point_count: number;
}

export interface SearchResponse {
  query: SearchParams;
  results: CalendarResult[];
  opportunities: Opportunity[];
  meta: SearchMeta;
}

export interface RouteInfo {
  id: string;
  origin: string;
  dest: string;
  trip_type: TripType;
  tier: string;
  nearby_airports: string[];
  stay_rep: number | null;
  enabled: boolean;
}

export interface HistoryEntry {
  id: string;
  params: SearchParams;
  at: number;
  label: string;
}
