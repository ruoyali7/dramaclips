import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ingestSocialPosts } from "@/lib/admin/social-post-ingestion";

const postSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube", "facebook", "x"]),
  externalId: z.string().trim().min(1).max(300),
  url: z.string().url(),
  creator: z.string().max(300).optional(),
  caption: z.string().max(10000).optional(),
  hashtags: z.array(z.string().max(100)).max(50).optional(),
  dramaId: z.string().uuid().optional(),
  publishedAt: z.string().datetime().optional(),
  views: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
});
const schema = z.object({ source: z.string().trim().min(1).max(100), posts: z.array(postSchema).min(1).max(500) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json({ result: await ingestSocialPosts(input.source, input.posts) }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not ingest social posts" }, { status: 400 });
  }
}
