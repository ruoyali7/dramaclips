import "server-only";
import { getSupabaseConfig } from "./supabase-config";
import { aggregateHashtagPerformance, type HashtagPost, type HashtagPerformance } from "./hashtag-performance";

export type SocialPostInput = {
  platform: "tiktok" | "instagram" | "youtube" | "facebook" | "x";
  externalId: string;
  url: string;
  creator?: string;
  caption?: string;
  hashtags?: string[];
  dramaId?: string;
  publishedAt?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
};

export function normalizeHashtag(value: string) {
  return value.trim().replace(/^#/, "").toLowerCase().replace(/[^a-z0-9_]+/g, "").slice(0, 80);
}

export function normalizeSocialPost(input: SocialPostInput) {
  const hashtags = Array.from(new Set((input.hashtags || []).map(normalizeHashtag).filter(Boolean)));
  return { ...input, hashtags };
}

async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: config.key, Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0, 220)}`);
  return response.status === 204 ? null : response.json();
}

export async function ingestSocialPosts(source: string, posts: SocialPostInput[]) {
  const normalized = posts.map(normalizeSocialPost);
  let snapshots = 0;
  for (const post of normalized) {
    const rows = await request("social_posts?on_conflict=platform,external_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        platform: post.platform,
        external_id: post.externalId,
        url: post.url,
        creator: post.creator || null,
        caption: post.caption || null,
        hashtags: post.hashtags,
        drama_id: post.dramaId || null,
        published_at: post.publishedAt || null,
        source,
        crawled_at: new Date().toISOString(),
      }),
    }) as { id: string }[];
    const postId = rows[0]?.id;
    if (!postId || [post.views, post.likes, post.comments, post.shares].every((value) => value == null)) continue;
    await request("social_metric_snapshots", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ post_id: postId, views: post.views ?? null, likes: post.likes ?? null, comments: post.comments ?? null, shares: post.shares ?? null }),
    });
    snapshots += 1;
  }
  return { posts: normalized.length, snapshots };
}

export async function computeHashtagPerformance(windowStart?: string, windowEnd?: string) {
  const end = windowEnd || new Date().toISOString();
  const start = windowStart || new Date(Date.now() - 7 * 86400000).toISOString();
  const posts = await request(`social_posts?select=id,platform,hashtags,published_at&published_at=gte.${encodeURIComponent(start)}&published_at=lte.${encodeURIComponent(end)}`) as { id: string; platform: string; hashtags: string[] }[];
  if (!posts.length) return { windowStart: start, windowEnd: end, rows: [] as HashtagPerformance[] };
  const ids = posts.map((post) => post.id);
  const snapshots = await request(`social_metric_snapshots?select=post_id,views,likes,comments,shares,captured_at&post_id=in.(${ids.join(",")})&order=captured_at.desc`) as { post_id: string; views?: number; likes?: number; comments?: number; shares?: number; captured_at: string }[];
  const latest = new Map<string, (typeof snapshots)[number]>();
  for (const snapshot of snapshots) if (!latest.has(snapshot.post_id)) latest.set(snapshot.post_id, snapshot);
  const input: HashtagPost[] = posts.map((post) => ({ ...post, ...latest.get(post.id) })).filter((post) => latest.has(post.id)) as HashtagPost[];
  const rows = aggregateHashtagPerformance(input);
  for (const row of rows) {
    await request("hashtag_performance_snapshots?on_conflict=platform,hashtag,window_start,window_end", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ platform: row.platform, hashtag: row.hashtag, window_start: start, window_end: end, usage_count: row.usageCount, average_views: row.averageViews, median_views: row.medianViews, engagement_rate: row.engagementRate, viral_rate: row.viralRate, relevance_score: row.relevanceScore, competition_score: row.competitionScore, score: row.score, source: "social-post-snapshots" }),
    });
  }
  return { windowStart: start, windowEnd: end, rows };
}

export async function listHashtagPerformance(platform?: string, limit = 50) {
  const filter = platform ? `&platform=eq.${encodeURIComponent(platform)}` : "";
  return await request(`hashtag_performance_snapshots?select=*&order=score.desc,window_end.desc&limit=${Math.min(200, Math.max(1, limit))}${filter}`);
}
