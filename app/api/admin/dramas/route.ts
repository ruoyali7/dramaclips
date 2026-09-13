import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { dramaDraftSchema } from "@/lib/admin/drama-schema";
import { publishDramaDraft, saveDramaDraft } from "@/lib/admin/repository";
import { queueDramaEpisodes } from "@/lib/admin/queue-drama-episodes";

export async function POST(request: NextRequest) {
  try {
    const input = dramaDraftSchema.parse(await request.json());
    const draft = await saveDramaDraft(input);
    await publishDramaDraft(draft.id);
    const vizard = await queueDramaEpisodes({...draft, language: input.language}, input.episodes);
    return NextResponse.json({draft: {...draft, status: "published"}, vizard, queueEpisodeNumbers: input.episodes.map(episode => episode.episodeNumber)}, {status: 201});
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({code: "VALIDATION_ERROR", message: "Check the highlighted fields", fieldErrors: error.flatten().fieldErrors}, {status: 400});
    const duplicate = error instanceof Error && /23505|duplicate key|already exists/i.test(error.message);
    console.error("[admin] drama publish failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({code: duplicate ? "DUPLICATE_DRAMA" : "PUBLISH_FAILED", message: duplicate ? "This slug or referral code already exists. Open the existing drama to edit it." : "Could not publish the drama. Check Drama bundles before retrying."}, {status: duplicate ? 409 : 500});
  }
}
