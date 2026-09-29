import detail from "@/lib/faultline/snapshot-detail.json";

export type SeriesPoint = { d: string; p: number; v: number; h: number | null };
export type HistoryEvent = { date: string; text: string };

const rows = detail as Record<string, { series: SeriesPoint[]; history: HistoryEvent[] }>;

export function assetDetail(id: number) {
  return rows[String(id)] ?? { series: [], history: [] };
}
