import "server-only";

export type ImportedDrama = {
  title?: string; slug?: string; publicCode?: string; promoCode?: string; language?: string;
  tags?: string[]; description?: string; coverUrl?: string; cpsUrl?: string; chapterCount?: number; freeChapterCount?: number;
};

export function parseRsUrl(value: string) {
  const url = new URL(value);
  if (url.hostname !== "cps.reelshort.com") throw new Error("Use a cps.reelshort.com resource detail link");
  const match = url.pathname.match(/^\/resource-square\/detail\/([a-f0-9]+)$/i);
  if (!match) throw new Error("Use an RS Boost resource detail link");
  return { resourceId: match[1], app: url.searchParams.get("app") || "reelshort", bookType: Number(url.searchParams.get("book_type") || 0) };
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
}

function flatten(input: unknown, result: Record<string, unknown> = {}) {
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    result[key.toLowerCase()] ??= value;
    if (value && typeof value === "object" && !Array.isArray(value)) flatten(value, result);
  }
  return result;
}

function first(map: Record<string, unknown>, keys: string[]) {
  for (const key of keys) { const value = map[key]; if (typeof value === "string" && value.trim()) return value.trim(); }
}

function number(map: Record<string, unknown>, keys: string[]) {
  for (const key of keys) { const value = Number(map[key]); if (Number.isFinite(value) && value > 0) return value; }
}

function list(value: unknown) {
  if (typeof value === "string") return value.split(/[,，|]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === "string" ? item : item && typeof item === "object" ? String((item as Record<string, unknown>).name || (item as Record<string, unknown>).label || "") : "").map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

export function normalizeRsPayload(payload: unknown): ImportedDrama {
  const source = (payload as { data?: unknown })?.data ?? payload;
  const map = flatten(source);
  const title = first(map, ["book_name", "title", "book_title", "name"]);
  const promoCode = first(map, ["promotion_code", "promo_code", "resource_code", "code"]);
  const cpsUrl = first(map, ["book_promotion_link", "resource_promotion_link", "promotion_url", "promote_url", "cps_url"]);
  const rawTags = map.tags ?? map.tag_list ?? map.labels ?? map.category_list;
  return {
    title, slug: title ? slugify(title) : undefined,
    publicCode: promoCode && /^\d{4,8}$/.test(promoCode) ? promoCode : undefined,
    promoCode, language: first(map, ["language", "lang", "book_language"])?.toLowerCase().startsWith("zh") ? "zh" : "en",
    tags: list(rawTags), description: first(map, ["description", "book_desc", "intro", "introduction", "abstract", "summary"]),
    coverUrl: first(map, ["cover_url", "book_cover", "cover", "cover_image"]), cpsUrl,
    chapterCount: number(map, ["chapter_count", "total_chapter_num", "chapter_num", "total_chapters"]),
    freeChapterCount: number(map, ["free_chapter_count", "free_chapter_num", "free_chapters", "preview_chapter_count"]),
  };
}

export function parseRsText(text: string): ImportedDrama {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = (label: string) => lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  const after = (labels: string[]) => { for (const label of labels) { const position = index(label); if (position >= 0 && lines[position + 1]) return lines[position + 1]; } };
  const matchingAfter = (labels: string[], pattern: RegExp) => { for (const label of labels) { const position = index(label); if (position >= 0) { const match = lines.slice(position + 1, position + 8).find((line) => pattern.test(line)); if (match) return match; } } };
  const releasePosition = lines.findIndex((line) => /^(上线时间|Release date)/i.test(line));
  const languagePosition = releasePosition > 0 ? lines.slice(0, releasePosition).findLastIndex((line) => /^(英语|中文|English|Chinese)$/i.test(line)) : -1;
  const titleBeforeLanguage = languagePosition > 0 ? lines[languagePosition - 1] : undefined;
  const title = after(["cover"]) || titleBeforeLanguage || lines.find((line, position) => position > 0 && /[A-Za-z]{3}/.test(line) && !/RS Boost|Content Hub|My Referral|My Earnings|资源广场|我的推广|我的收益/.test(line));
  const promoCode = matchingAfter(["资源推广口令", "Resource Promotion Code", "Content Referral Code"], /^\d{4,8}$/) || lines.find((line) => /^\d{6,8}$/.test(line));
  const resourceLinkPosition = Math.max(index("资源推广链接"), index("Resource Promotion Link"));
  const capturedPromotionLinks = lines.filter((line) => /^https:\/\/reelslink\.com\/cps\//.test(line));
  const cpsUrl = (resourceLinkPosition >= 0 ? lines.slice(resourceLinkPosition + 1).find((line) => /^https:\/\/reelslink\.com\/cps\//.test(line)) : undefined) || capturedPromotionLinks.at(-1);
  const languageLine = lines.find((line) => /^(英语|中文|English|Chinese)$/i.test(line));
  const tagLanguagePosition = languageLine ? lines.indexOf(languageLine) : -1;
  const tags = tagLanguagePosition >= 0 && releasePosition > tagLanguagePosition ? lines.slice(tagLanguagePosition + 1, releasePosition).filter((line) => line.length <= 40 && !/^共\d+章/.test(line)).slice(0, 8) : [];
  const description = lines.find((line) => line.length > 100 && !line.startsWith("http"));
  const chapterLine = lines.find((line) => /共\s*\d+\s*章|\d+\s*(?:chapters?|episodes?)/i.test(line));
  const chapterCount = chapterLine ? Number(chapterLine.match(/\d+/)?.[0]) : undefined;
  const freeChapterCount = chapterLine ? Number(chapterLine.match(/前\s*(\d+)\s*章节免费|first\s*(\d+)\s*(?:(?:chapters?|episodes?)\s*)?free/i)?.slice(1).find(Boolean)) || undefined : undefined;
  const capturedImages = lines.map((line) => line.match(/^DRAMACLIPS_IMAGE\|([^|]*)\|(https?:\/\/[^|]+)\|(\d+)\|(\d+)$/)).filter((match): match is RegExpMatchArray => Boolean(match));
  const cover = capturedImages.find((match) => /cover/i.test(match[1]) && !/avatar/i.test(match[1])) || capturedImages.find((match) => Number(match[5]) > Number(match[4]) && Number(match[4]) >= 160);
  return { title, slug: title ? slugify(title) : undefined, publicCode: promoCode, promoCode, language: /中文|Chinese/i.test(languageLine || "") ? "zh" : "en", tags, description, coverUrl: cover?.[2], cpsUrl, chapterCount, freeChapterCount };
}

export async function importFromRs(link?: string, detailsText?: string) {
  if (detailsText?.trim() && !link?.trim()) return parseRsText(detailsText);
  if (!link?.trim()) throw new Error("Paste the RS Boost page text or provide a detail link");
  const parsed = parseRsUrl(link);
  const token = process.env.RS_BOOST_API_TOKEN?.trim();
  if (!token) {
    if (detailsText?.trim()) return parseRsText(detailsText);
    const error = new Error("RS Boost connection is not configured") as Error & { code?: string };
    error.code = "RS_CONNECTION_REQUIRED";
    throw error;
  }
  const response = await fetch("https://cps.reelshort.com/api/v1/book/book-detail", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "Accept-Language": "en" }, body: JSON.stringify({ book_id: parsed.resourceId, id: parsed.resourceId, app: parsed.app, book_type: parsed.bookType }), cache: "no-store" });
  if (response.status === 401) throw Object.assign(new Error("RS Boost connection expired"), { code: "RS_CONNECTION_EXPIRED" });
  if (!response.ok) throw new Error(`RS Boost returned ${response.status}`);
  const result = normalizeRsPayload(await response.json());
  if (!result.title) throw new Error("RS Boost response did not contain recognizable drama details");
  return result;
}
