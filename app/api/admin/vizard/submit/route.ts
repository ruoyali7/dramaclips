import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { submitToVizard } from "@/lib/admin/vizard";

const schema = z.object({
  dramaId: z.string().min(1), dramaSlug: z.string().min(1), episodeNumber: z.number().int().positive(),
  projectName: z.string().trim().min(2).max(140),
  videoUrl: z.string().url().refine((value) => new URL(value).protocol === "https:"),
  language: z.string().trim().min(2).max(12).default("auto"),
  preferLength: z.number().int().min(0).max(4),
  maxClipNumber: z.number().int().min(1).max(20),
  ratio: z.number().int().min(1).max(4),
  subtitles: z.boolean(),
  headline: z.boolean(),
  clipModel: z.enum(["clip_v1", "clip_v2"]),
});

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await submitToVizard(schema.parse(await request.json())), { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the Vizard settings" }, { status: 400 });
    const retryable = Boolean((error as Error & { retryable?: boolean }).retryable);
    console.error("[admin] Vizard submit failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: error instanceof Error ? error.message : "Vizard submission failed", retryable }, { status: retryable ? 429 : 502 });
  }
}
