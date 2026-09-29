import "server-only";
import { getSupabaseConfig } from "./supabase-config";

export type WeeklyPublishPlan = {
  id: string;
  status: "planning" | "paused" | "scheduled" | "failed";
  startDate: string;
  endDate: string;
  requiredVideos: number;
  availableVideos: number;
  missingVideos: number;
  scheduledVideos: number;
  nextDramaSlug?: string;
  nextEpisodeNumber?: number;
  errorMessage?: string;
  telegramNotifiedAt?: string;
  createdAt: string;
};

type Row = Record<string, any>;
const fromRow = (row: Row): WeeklyPublishPlan => ({
  id: row.id, status: row.status, startDate: row.start_date, endDate: row.end_date,
  requiredVideos: Number(row.required_videos), availableVideos: Number(row.available_videos),
  missingVideos: Number(row.missing_videos), scheduledVideos: Number(row.scheduled_videos),
  nextDramaSlug: row.next_drama_slug || undefined, nextEpisodeNumber: row.next_episode_number == null ? undefined : Number(row.next_episode_number),
  errorMessage: row.error_message || undefined, telegramNotifiedAt: row.telegram_notified_at || undefined,
  createdAt: row.created_at,
});

async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init, cache: "no-store", headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) throw new Error((await response.text()) || `Supabase ${response.status}`);
  return response.status === 204 ? null : response.json();
}

export async function getLatestWeeklyPublishPlan() {
  const rows = await request("publish_weekly_plans?select=*&order=created_at.desc&limit=1") as Row[];
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function createWeeklyPublishPlan(input: Omit<WeeklyPublishPlan, "id" | "createdAt" | "telegramNotifiedAt">) {
  const rows = await request("publish_weekly_plans", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
    status: input.status, start_date: input.startDate, end_date: input.endDate,
    required_videos: input.requiredVideos, available_videos: input.availableVideos,
    missing_videos: input.missingVideos, scheduled_videos: input.scheduledVideos,
    next_drama_slug: input.nextDramaSlug || null, next_episode_number: input.nextEpisodeNumber || null,
    error_message: input.errorMessage || null,
  }) }) as Row[];
  return fromRow(rows[0]);
}

export async function updateWeeklyPublishPlan(id: string, input: Partial<Omit<WeeklyPublishPlan, "id" | "createdAt">>) {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) body.status = input.status;
  if (input.startDate) body.start_date = input.startDate;
  if (input.endDate) body.end_date = input.endDate;
  if (input.availableVideos != null) body.available_videos = input.availableVideos;
  if (input.missingVideos != null) body.missing_videos = input.missingVideos;
  if (input.scheduledVideos != null) body.scheduled_videos = input.scheduledVideos;
  if ("nextDramaSlug" in input) body.next_drama_slug = input.nextDramaSlug || null;
  if ("nextEpisodeNumber" in input) body.next_episode_number = input.nextEpisodeNumber || null;
  if ("errorMessage" in input) body.error_message = input.errorMessage || null;
  if (input.status === "scheduled") body.completed_at = new Date().toISOString();
  const rows = await request(`publish_weekly_plans?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) }) as Row[];
  if (!rows[0]) throw new Error("Weekly publish plan not found");
  return fromRow(rows[0]);
}
