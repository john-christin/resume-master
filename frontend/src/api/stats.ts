import api from "./client";

export interface MyDailyPoint {
  date: string;
  count: number;
  cost: number;
}

export interface MyProfileStat {
  profile_id: string;
  name: string;
  count: number;
  cost: number;
}

export interface MySummary {
  today_count: number;
  week_count: number;
  month_count: number;
  month_cost: number;
  calls_scheduled: number;
}

export interface MyStatsResponse {
  summary: MySummary;
  daily: MyDailyPoint[];
  daily_calls: MyDailyPoint[];
  profiles: MyProfileStat[];
}

export const getMyStats = (from?: string, to?: string) => {
  const p = new URLSearchParams();
  if (from) p.set("from_date", from);
  if (to) p.set("to_date", to);
  const qs = p.toString();
  return api.get<MyStatsResponse>(`/api/stats/me${qs ? `?${qs}` : ""}`);
};
