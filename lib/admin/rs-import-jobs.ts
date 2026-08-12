import "server-only";
import { copyRsVideoToR2 } from "./r2";
import { encryptSensitive } from "./encryption";
import { parseRsText } from "./rs-import";
import { getSupabaseConfig } from "./supabase-config";

type Chapter = {
  episodeNumber: number;
  chapterId: string;
  tChapterId: string;
  playUrl: string;
  videoUrl: string;
  status: "queued" | "running" | "succeeded" | "failed";
  error?: string;
};
type Drama = { bookId: string; title: string; slug: string; publicCode: string; promoCode: string; language: string; tags: string[]; description: string; coverUrl: string; cpsUrl: string; chapterCount: number; availableCount: number };
type Row = { id: string; rs_book_id: string; status: string; drama: Drama; chapters: Chapter[]; error?: string; created_at: string; updated_at: string };
type Transfer = { source: string; text: string; book: Record<string, unknown>; chapters: Array<Record<string, unknown>> };

async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, { ...init, headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", ...init.headers }, cache: "no-store" });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 220)}`);
  return response.status === 204 ? null : response.json();
}

function safe(row: Row) {
  return { id: row.id, status: row.status, drama: row.drama, chapters: row.chapters.map(({ playUrl: _, ...chapter }) => chapter), createdAt: row.created_at };
}
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function num(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function transferChapters(input: Transfer) {
  return input.chapters.map((item, index) => ({ episodeNumber: num(item.episode_number) || index + 1, chapterId: text(item.chapter_id), tChapterId: text(item.t_chapter_id), playUrl: text(item.play_url), videoUrl: "", status: "queued" as const })).filter((item) => item.playUrl).slice(0, 100);
}

export async function previewRsImport(input: Transfer) {
  const source = new URL(input.source);
  if (source.protocol !== "https:" || source.hostname !== "cps.reelshort.com") throw new Error("Invalid RS source page");
  const parsed = parseRsText(input.text);
  const bookId = text(input.book.book_id);
  if (!/^[a-f0-9]{16,40}$/i.test(bookId)) throw new Error("Invalid RS book id");
  const chapters = transferChapters(input);
  if (!chapters.length) throw new Error("RS returned no authorized free episodes");
  const drama: Drama = { bookId, title: text(input.book.book_name) || parsed.title || "", slug: parsed.slug || "", publicCode: parsed.publicCode || "", promoCode: parsed.promoCode || parsed.publicCode || "", language: parsed.language || "en", tags: parsed.tags || [], description: text(input.book.description) || parsed.description || "", coverUrl: text(input.book.cover_url) || parsed.coverUrl || "", cpsUrl: parsed.cpsUrl || "", chapterCount: num(input.book.chapter_count), availableCount: chapters.length };
  if (!drama.title || !drama.slug) throw new Error("RS metadata is missing title");
  if (!/^\d{4,8}$/.test(drama.publicCode) || !drama.cpsUrl) throw new Error("RS page is missing the referral code or Content Promotion Link");
  const existing = await request(`drama_bundles?or=(rs_book_id.eq.${encodeURIComponent(bookId)},slug.eq.${encodeURIComponent(drama.slug)})&select=id,title,slug,episodes&limit=1`) as Array<{ id: string; title: string; slug: string; episodes: unknown[] }>;
  return { drama: { ...drama, cpsUrl: "available" }, availableCount: chapters.length, existing: existing[0] ? { id: existing[0].id, title: existing[0].title, episodeCount: Array.isArray(existing[0].episodes) ? existing[0].episodes.length : 0 } : null, authorizedOnly: true };
}

export async function createRsImportJob(input: Transfer) {
  await previewRsImport(input);
  const parsed = parseRsText(input.text);
  const bookId = text(input.book.book_id);
  const existing = await request(`drama_bundles?or=(rs_book_id.eq.${encodeURIComponent(bookId)},slug.eq.${encodeURIComponent(parsed.slug || "")})&select=episodes&limit=1`) as Array<{ episodes: Array<{ episodeNumber: number; videoUrl: string }> }>;
  const existingEpisodes = new Map((existing[0]?.episodes || []).map((episode) => [Number(episode.episodeNumber), text(episode.videoUrl)]));
  const chapters: Chapter[] = transferChapters(input).map((chapter) => { const videoUrl = existingEpisodes.get(chapter.episodeNumber) || ""; return { ...chapter, playUrl: videoUrl ? "" : chapter.playUrl, videoUrl, status: videoUrl ? "succeeded" : "queued" }; });
  const drama: Drama = { bookId, title: text(input.book.book_name) || parsed.title || "", slug: parsed.slug || "", publicCode: parsed.publicCode || "", promoCode: parsed.promoCode || parsed.publicCode || "", language: parsed.language || "en", tags: parsed.tags || [], description: text(input.book.description) || parsed.description || "", coverUrl: text(input.book.cover_url) || parsed.coverUrl || "", cpsUrl: parsed.cpsUrl || "", chapterCount: num(input.book.chapter_count), availableCount: chapters.length };
  const complete = chapters.every((chapter) => chapter.status === "succeeded");
  const rows = await request("rs_import_jobs", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ rs_book_id: bookId, status: complete ? "succeeded" : "queued", drama, chapters }) }) as Row[];
  return safe(rows[0]);
}

export async function getRsImportJob(id: string, raw = false) {
  const rows = await request(`rs_import_jobs?id=eq.${encodeURIComponent(id)}&select=*&limit=1`) as Row[];
  if (!rows[0]) return null;
  return raw ? rows[0] : safe(rows[0]);
}

export async function processRsEpisode(id: string, episodeNumber: number) {
  const row = await getRsImportJob(id, true) as Row | null;
  if (!row) throw new Error("Import job not found");
  const chapter = row.chapters.find((item) => item.episodeNumber === episodeNumber);
  if (!chapter) throw new Error("Episode not found");
  if (chapter.status === "succeeded") return safe(row);
  await patchChapter(id, episodeNumber, { status: "running", error: null });
  await setJobStatus(id, "running");
  try {
    const copied = await copyRsVideoToR2({ url: chapter.playUrl, slug: row.drama.slug, episodeNumber });
    const chapters = await patchChapter(id, episodeNumber, { videoUrl: copied.publicUrl, playUrl: "", status: "succeeded", error: null });
    const latest = { ...row, chapters };
    if (chapters.every((item) => item.status === "succeeded")) { await finalize(latest); await setJobStatus(id, "succeeded"); }
    return safe((await getRsImportJob(id, true)) as Row);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    await patchChapter(id, episodeNumber, { status: "failed", error: message });
    await setJobStatus(id, "failed", message);
    throw error;
  }
}

async function patchChapter(id: string, episodeNumber: number, patch: Record<string, unknown>) {
  return await request("rpc/patch_rs_import_chapter", { method: "POST", body: JSON.stringify({ p_job_id: id, p_episode_number: episodeNumber, p_patch: patch }) }) as Chapter[];
}
async function setJobStatus(id: string, status: string, error = "") {
  await request(`rs_import_jobs?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status, error: error || null, updated_at: new Date().toISOString() }) });
}
async function finalize(row: Row) {
  const drama = row.drama;
  if (!/^\d{4,8}$/.test(drama.publicCode) || !drama.cpsUrl) throw new Error("Referral code or content promotion link is missing; edit the drama after import");
  const payload = { rs_book_id: drama.bookId, status: "draft", title: drama.title, slug: drama.slug, public_code: drama.publicCode, promo_code: drama.promoCode, language: drama.language, tags: drama.tags, description: drama.description || `${drama.title} imported from authorized RS Boost previews.`, cover_url: drama.coverUrl || "/covers/placeholder.jpg", episodes: row.chapters.map((chapter) => ({ episodeNumber: chapter.episodeNumber, videoUrl: chapter.videoUrl })), cps_url_encrypted: encryptSensitive(drama.cpsUrl), updated_at: new Date().toISOString() };
  const existing = await request(`drama_bundles?or=(rs_book_id.eq.${encodeURIComponent(drama.bookId)},slug.eq.${encodeURIComponent(drama.slug)})&select=id&limit=1`) as Array<{ id: string }>;
  if (existing[0]) await request(`drama_bundles?id=eq.${existing[0].id}`, { method: "PATCH", body: JSON.stringify(payload) });
  else await request("drama_bundles", { method: "POST", body: JSON.stringify(payload) });
}
