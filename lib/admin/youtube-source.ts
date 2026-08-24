import type { SocialPostInput } from "./social-post-ingestion";

const API = "https://www.googleapis.com/youtube/v3";
type YouTubeSearch = { items?: { id?: { videoId?: string } }[] };
type YouTubeVideos = { items?: { id: string; snippet?: { title?: string; description?: string; channelTitle?: string; publishedAt?: string; tags?: string[] }; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[] };

function number(value?: string) { return value ? Number.parseInt(value, 10) || undefined : undefined; }
function hashtags(text: string) { return Array.from(text.matchAll(/#[A-Za-z0-9_-]+/g), (match) => match[0]); }

export function mapYouTubeVideos(payload: YouTubeVideos): SocialPostInput[] {
  return (payload.items || []).map((item) => {
    const snippet = item.snippet || {};
    const text = `${snippet.title || ""}\n${snippet.description || ""}`;
    return {
      platform: "youtube",
      externalId: item.id,
      url: `https://www.youtube.com/watch?v=${encodeURIComponent(item.id)}`,
      creator: snippet.channelTitle,
      caption: snippet.title,
      hashtags: [...hashtags(text), ...(snippet.tags || []).filter((tag) => tag.startsWith("#"))],
      publishedAt: snippet.publishedAt,
      views: number(item.statistics?.viewCount),
      likes: number(item.statistics?.likeCount),
      comments: number(item.statistics?.commentCount),
    };
  });
}

export async function fetchYouTubeShortDramaPosts(query: string, options: { apiKey?: string; maxResults?: number; publishedAfter?: string } = {}) {
  const apiKey = options.apiKey || process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) throw new Error("YOUTUBE_DATA_API_KEY is not configured");
  const params = new URLSearchParams({ key: apiKey, part: "snippet", q: query, type: "video", videoDuration: "short", order: "date", maxResults: String(Math.min(50, Math.max(1, options.maxResults || 25))) });
  if (options.publishedAfter) params.set("publishedAfter", options.publishedAfter);
  const searchResponse = await fetch(`${API}/search?${params}`, { cache: "no-store" });
  if (!searchResponse.ok) throw new Error(`YouTube search failed (${searchResponse.status})`);
  const search = await searchResponse.json() as YouTubeSearch;
  const ids = (search.items || []).map((item) => item.id?.videoId).filter(Boolean) as string[];
  if (!ids.length) return [];
  const videoParams = new URLSearchParams({ key: apiKey, part: "snippet,statistics", id: ids.join(",") });
  const videoResponse = await fetch(`${API}/videos?${videoParams}`, { cache: "no-store" });
  if (!videoResponse.ok) throw new Error(`YouTube video lookup failed (${videoResponse.status})`);
  return mapYouTubeVideos(await videoResponse.json() as YouTubeVideos);
}
