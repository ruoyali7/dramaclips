import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchYouTubeShortDramaPosts } from "@/lib/admin/youtube-source";
import { ingestSocialPosts } from "@/lib/admin/social-post-ingestion";

const schema = z.object({ query: z.string().trim().min(2).max(100), maxResults: z.number().int().min(1).max(50).optional(), publishedAfter: z.string().datetime().optional() });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const posts = await fetchYouTubeShortDramaPosts(input.query, input);
    const result = await ingestSocialPosts("youtube-data-api", posts);
    return NextResponse.json({ result: { ...result, query: input.query } }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not crawl YouTube" }, { status: 503 });
  }
}
