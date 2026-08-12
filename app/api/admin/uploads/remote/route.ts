import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { copyRemoteVideoToR2 } from "@/lib/admin/r2";

export const maxDuration = 300;

const schema = z.object({
  url: z.string().url(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  episodeNumber: z.number().int().min(1).max(100),
});

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await copyRemoteVideoToR2(input));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the video URL, slug, and episode number" }, { status: 400 });
    console.error("[admin] remote R2 transfer failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not transfer video to R2" }, { status: 502 });
  }
}
