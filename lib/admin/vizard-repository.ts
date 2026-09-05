import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseConfig } from "./supabase-config";
import {deleteSocialVideo} from "./r2";

export type VizardProject = {
  id: string; dramaId: string; dramaSlug: string; episodeNumber: number;
  projectName: string; vizardProjectId: string; sourceVideoUrl: string;
  settings: Record<string, unknown>; status: string; finalVideoUrl?: string;
  finalObjectKey?: string; finalLabel?: string; editInfo: Record<string, unknown>;
  submittedAt: string; updatedAt: string;
};
export type VizardAsset = { id: string; projectId: string; dramaSlug: string; episodeNumber: number; vizardVideoId: string; title: string; videoUrl: string; objectKey: string; durationSeconds: number; transcript?: string; viralScore?: string; viralReason?: string; clipEditorUrl?: string; metadata: Record<string, unknown>; reviewState:"pending"|"approved"; createdAt: string };
type Row = Record<string, any>;
export type VizardSubmissionInput = { dramaId: string; dramaSlug: string; episodeNumber: number; projectName: string; videoUrl: string; settings: Record<string, unknown> };
const local: VizardProject[] = [];
async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig(); if (!config.configured) return null;
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase ${response.status}`); return response.status === 204 ? null : response.json();
}
export async function enqueueVizardSubmissions(input: VizardSubmissionInput[]) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const pending = await request("vizard_submission_jobs?status=in.(queued,submitting,rate_limited)&select=next_attempt_at&order=next_attempt_at.desc&limit=1") as Row[];
  const latestScheduled = pending[0]?.next_attempt_at ? Date.parse(pending[0].next_attempt_at) : 0;
  const scheduleStart = Math.max(Date.now(), latestScheduled + (latestScheduled ? 30_000 : 0));
  const rows = input.map((item, index) => ({ drama_id: item.dramaId, drama_slug: item.dramaSlug, episode_number: item.episodeNumber, project_name: item.projectName, video_url: item.videoUrl, settings: item.settings, next_attempt_at: new Date(scheduleStart + index * 30_000).toISOString() }));
  const retried = (await Promise.all(rows.map((row) => request(`vizard_submission_jobs?drama_id=eq.${encodeURIComponent(row.drama_id)}&episode_number=eq.${row.episode_number}&status=in.(canceled,failed)`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ ...row, status: "queued", attempt_count: 0, error_message: null, vizard_project_id: null, lease_owner: null, lease_expires_at: null, updated_at: new Date().toISOString() }) }) as Promise<Row[]>))).flat();
  const queued = await request("vizard_submission_jobs?on_conflict=drama_id,episode_number,project_name", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify(rows) }) as Row[];
  return [...retried, ...queued];
}
function fromRow(row: Row): VizardProject { return { id: row.id, dramaId: row.drama_id, dramaSlug: row.drama_slug, episodeNumber: row.episode_number, projectName: row.project_name, vizardProjectId: row.vizard_project_id, sourceVideoUrl: row.source_video_url, settings: row.settings || {}, status: row.status, finalVideoUrl: row.final_video_url || undefined, finalObjectKey: row.final_object_key || undefined, finalLabel: row.final_label || undefined, editInfo: row.edit_info || {}, submittedAt: row.submitted_at, updatedAt: row.updated_at }; }
export async function createVizardProject(input: Omit<VizardProject, "id" | "submittedAt" | "updatedAt">) {
  const now = new Date().toISOString(); const row = { id: randomUUID(), ...input, submittedAt: now, updatedAt: now };
  const config = getSupabaseConfig(); if (!config.configured) { local.unshift(row); return row; }
  const rows = await request("vizard_projects", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ drama_id: input.dramaId, drama_slug: input.dramaSlug, episode_number: input.episodeNumber, project_name: input.projectName, vizard_project_id: input.vizardProjectId, source_video_url: input.sourceVideoUrl, settings: input.settings, status: input.status, edit_info: input.editInfo }) }) as Row[]; return fromRow(rows[0]);
}
export async function listVizardProjects(dramaSlug?: string) { const config = getSupabaseConfig(); if (!config.configured) return local.filter(x => !dramaSlug || x.dramaSlug === dramaSlug); const filter = dramaSlug ? `&drama_slug=eq.${encodeURIComponent(dramaSlug)}` : ""; const rows = await request(`vizard_projects?select=*&order=submitted_at.desc${filter}`) as Row[]; return rows.map(fromRow); }
export async function updateVizardProject(id: string, input: { status?: string; finalVideoUrl?: string; finalObjectKey?: string; finalLabel?: string; editInfo?: Record<string, unknown> }) {
  const patch = { status: input.status, final_video_url: input.finalVideoUrl, final_object_key: input.finalObjectKey, final_label: input.finalLabel, edit_info: input.editInfo, updated_at: new Date().toISOString() }; const config = getSupabaseConfig();
  if (!config.configured) { const row = local.find(x => x.id === id); if (!row) throw new Error("Vizard project not found"); Object.assign(row, input, { updatedAt: patch.updated_at }); return row; }
  const rows = await request(`vizard_projects?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }) as Row[]; if (!rows[0]) throw new Error("Vizard project not found"); return fromRow(rows[0]);
}
 export async function saveVizardAsset(input: Omit<VizardAsset, "id" | "createdAt" | "reviewState">) { const now = new Date().toISOString(); const row = { id: randomUUID(), ...input, reviewState: "approved" as const, createdAt: now }; const config = getSupabaseConfig(); if (!config.configured) { return row; } const rows = await request("vizard_assets", { method: "POST", headers: { Prefer: "return=representation,resolution=ignore-duplicates" }, body: JSON.stringify({ project_id: input.projectId, drama_slug: input.dramaSlug, episode_number: input.episodeNumber, vizard_video_id: input.vizardVideoId, title: input.title, video_url: input.videoUrl, object_key: input.objectKey, duration_seconds: input.durationSeconds, transcript: input.transcript || null, viral_score: input.viralScore || null, viral_reason: input.viralReason || null, clip_editor_url: input.clipEditorUrl || null, metadata: input.metadata, review_state: "approved", reviewed_at: now }) }) as Row[]; return rows[0] ? fromAssetRow(rows[0]) : null; }
function fromAssetRow(row: Row): VizardAsset { return { id: row.id, projectId: row.project_id, dramaSlug: row.drama_slug, episodeNumber: row.episode_number, vizardVideoId: String(row.vizard_video_id), title: row.title, videoUrl: row.video_url, objectKey: row.object_key, durationSeconds: Number(row.duration_seconds), transcript: row.transcript || undefined, viralScore: row.viral_score || undefined, viralReason: row.viral_reason || undefined, clipEditorUrl: row.clip_editor_url || undefined, metadata: row.metadata || {}, reviewState:row.review_state||"pending", createdAt: row.created_at }; }
export async function listVizardAssets(dramaSlug?: string) { const config = getSupabaseConfig(); if (!config.configured) return []; const filter = dramaSlug ? `&drama_slug=eq.${encodeURIComponent(dramaSlug)}` : ""; const rows = await request(`vizard_assets?select=*&order=created_at.desc${filter}`) as Row[]; return rows.map(fromAssetRow); }
export async function reviewVizardAsset(id:string,action:"approve"|"delete") {const rows=await request(`vizard_assets?id=eq.${encodeURIComponent(id)}&select=*`) as Row[];const asset=rows?.[0]?fromAssetRow(rows[0]):null;if(!asset)throw new Error("Vizard hook not found");if(action==="approve"){const updated=await request(`vizard_assets?id=eq.${encodeURIComponent(id)}`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({review_state:"approved",reviewed_at:new Date().toISOString()})}) as Row[];return fromAssetRow(updated[0])}const pathname=decodeURIComponent(new URL(asset.videoUrl).pathname).replace(/^\//,"");const objectKey=pathname.slice(pathname.indexOf("dramas/"));if(objectKey.startsWith("dramas/"))await deleteSocialVideo(objectKey);await request(`vizard_assets?id=eq.${encodeURIComponent(id)}`,{method:"DELETE"});return asset}
