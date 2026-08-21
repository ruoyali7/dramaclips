import "server-only";
import { randomUUID } from "node:crypto";
import { getSupabaseConfig } from "./supabase-config";

export type VizardProject = {
  id: string; dramaId: string; dramaSlug: string; episodeNumber: number;
  projectName: string; vizardProjectId: string; sourceVideoUrl: string;
  settings: Record<string, unknown>; status: string; finalVideoUrl?: string;
  finalObjectKey?: string; finalLabel?: string; editInfo: Record<string, unknown>;
  submittedAt: string; updatedAt: string;
};
type Row = Record<string, any>;
const local: VizardProject[] = [];
async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig(); if (!config.configured) return null;
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase ${response.status}`); return response.status === 204 ? null : response.json();
}
function fromRow(row: Row): VizardProject { return { id: row.id, dramaId: row.drama_id, dramaSlug: row.drama_slug, episodeNumber: row.episode_number, projectName: row.project_name, vizardProjectId: row.vizard_project_id, sourceVideoUrl: row.source_video_url, settings: row.settings || {}, status: row.status, finalVideoUrl: row.final_video_url || undefined, finalObjectKey: row.final_object_key || undefined, finalLabel: row.final_label || undefined, editInfo: row.edit_info || {}, submittedAt: row.submitted_at, updatedAt: row.updated_at }; }
export async function createVizardProject(input: Omit<VizardProject, "id" | "submittedAt" | "updatedAt">) {
  const now = new Date().toISOString(); const row = { id: randomUUID(), ...input, submittedAt: now, updatedAt: now };
  const config = getSupabaseConfig(); if (!config.configured) { local.unshift(row); return row; }
  const rows = await request("vizard_projects", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ drama_id: input.dramaId, drama_slug: input.dramaSlug, episode_number: input.episodeNumber, project_name: input.projectName, vizard_project_id: input.vizardProjectId, source_video_url: input.sourceVideoUrl, settings: input.settings, status: input.status, edit_info: input.editInfo }) }) as Row[]; return fromRow(rows[0]);
}
export async function listVizardProjects(dramaSlug?: string) { const config = getSupabaseConfig(); if (!config.configured) return local.filter(x => (!dramaSlug || x.dramaSlug === dramaSlug) && x.finalVideoUrl); const filter = dramaSlug ? `&drama_slug=eq.${encodeURIComponent(dramaSlug)}` : ""; const rows = await request(`vizard_projects?select=*&final_video_url=not.is.null&order=submitted_at.desc${filter}`) as Row[]; return rows.map(fromRow); }
export async function updateVizardProject(id: string, input: { status?: string; finalVideoUrl?: string; finalObjectKey?: string; finalLabel?: string; editInfo?: Record<string, unknown> }) {
  const patch = { status: input.status, final_video_url: input.finalVideoUrl, final_object_key: input.finalObjectKey, final_label: input.finalLabel, edit_info: input.editInfo, updated_at: new Date().toISOString() }; const config = getSupabaseConfig();
  if (!config.configured) { const row = local.find(x => x.id === id); if (!row) throw new Error("Vizard project not found"); Object.assign(row, input, { updatedAt: patch.updated_at }); return row; }
  const rows = await request(`vizard_projects?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) }) as Row[]; if (!rows[0]) throw new Error("Vizard project not found"); return fromRow(rows[0]);
}
