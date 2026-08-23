export type HashtagPlatform = "tiktok" | "instagram" | "youtube" | "facebook" | "x";

export type HashtagCandidate = {
  tag: string;
  relevance: number;
  trend?: number;
  relatedPerformance?: number;
  competition?: number;
  source?: string;
};

export type HashtagRecommendation = HashtagCandidate & {
  score: number;
  source: string;
  reason: string;
};

const weights = { relevance: 0.3, trend: 0.25, relatedPerformance: 0.2, competition: 0.15 };

function cleanTag(value: string) {
  return value.replace(/^#/, "").replace(/[^a-zA-Z0-9_]+/g, "").slice(0, 28);
}

export function recommendHashtags(platform: HashtagPlatform, candidates: HashtagCandidate[], limit = 7) {
  const seen = new Set<string>();
  return candidates
    .map((candidate) => {
      const tag = cleanTag(candidate.tag);
      const trend = candidate.trend ?? 0;
      const relatedPerformance = candidate.relatedPerformance ?? 0;
      const competition = candidate.competition ?? 50;
      const score =
        candidate.relevance * weights.relevance +
        trend * weights.trend +
        relatedPerformance * weights.relatedPerformance +
        (100 - competition) * weights.competition;
      return {
        ...candidate,
        tag,
        trend,
        relatedPerformance,
        competition,
        score: Math.round(score * 100) / 100,
        source: candidate.source || "catalog-fallback",
        reason: trend || relatedPerformance
          ? `Relevant to this drama; ranked with ${platform} trend/performance signals.`
          : `Relevant to this drama; no live ${platform} trend data is connected yet.`,
      };
    })
    .filter((candidate) => candidate.tag && !seen.has(candidate.tag.toLowerCase()) && seen.add(candidate.tag.toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
