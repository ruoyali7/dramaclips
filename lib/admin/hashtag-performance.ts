export type HashtagPost = {
  platform: string;
  hashtags: string[];
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  relevance?: number;
};

export type HashtagPerformance = {
  platform: string;
  hashtag: string;
  usageCount: number;
  averageViews: number;
  medianViews: number;
  engagementRate: number;
  viralRate: number;
  relevanceScore: number;
  competitionScore: number;
  score: number;
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export function aggregateHashtagPerformance(posts: HashtagPost[], viralViewThreshold = 100_000) {
  const grouped = new Map<string, HashtagPost[]>();
  for (const post of posts) {
    for (const raw of post.hashtags) {
      const hashtag = raw.replace(/^#/, "").trim().toLowerCase();
      if (!hashtag) continue;
      const key = `${post.platform}:${hashtag}`;
      grouped.set(key, [...(grouped.get(key) || []), post]);
    }
  }
  return Array.from(grouped.entries()).map(([key, items]) => {
    const [platform, hashtag] = key.split(":");
    const views = items.map((item) => Math.max(0, item.views || 0));
    const totalViews = views.reduce((sum, value) => sum + value, 0);
    const totalEngagement = items.reduce((sum, item) => sum + (item.likes || 0) + (item.comments || 0) + (item.shares || 0), 0);
    const averageViews = totalViews / items.length;
    const engagementRate = totalViews ? (totalEngagement / totalViews) * 100 : 0;
    const viralRate = (views.filter((value) => value >= viralViewThreshold).length / items.length) * 100;
    const relevanceScore = items.reduce((sum, item) => sum + (item.relevance ?? 0), 0) / items.length;
    const competitionScore = Math.max(0, 100 - Math.min(100, items.length * 5));
    const score = averageViews === 0 && median(views) === 0
      ? relevanceScore * 0.15 + competitionScore * 0.1
      : averageViewsScore(averageViews) * 0.3 + viralRate * 0.2 + relevanceScore * 0.15 + competitionScore * 0.1 + Math.min(100, engagementRate) * 0.25;
    return { platform, hashtag, usageCount: items.length, averageViews: round(averageViews), medianViews: round(median(views)), engagementRate: round(engagementRate), viralRate: round(viralRate), relevanceScore: round(relevanceScore), competitionScore: round(competitionScore), score: round(score) };
  }).sort((a, b) => b.score - a.score) as HashtagPerformance[];
}

function averageViewsScore(value: number) {
  return Math.min(100, Math.log10(Math.max(1, value)) * 12.5);
}
function round(value: number) { return Math.round(value * 100) / 100; }
