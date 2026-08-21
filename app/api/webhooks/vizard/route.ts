import { NextRequest, NextResponse } from "next/server";
import { uploadSocialVideo } from "@/lib/admin/r2";
import { listVizardProjects, saveVizardAsset, updateVizardProject } from "@/lib/admin/vizard-repository";

export const maxDuration = 300;
function value(data: Record<string, unknown>, keys: string[]) { for (const key of keys) if (data[key] != null) return data[key]; return undefined; }
export async function POST(request: NextRequest) {
  const expected = process.env.VIZARD_WEBHOOK_SECRET?.trim(); const supplied = request.headers.get("x-vizard-webhook-secret") || request.nextUrl.searchParams.get("secret");
  if (expected && supplied !== expected) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = String(value(body, ["projectId", "project_id", "projectID"]) || (body.project as Record<string, unknown> | undefined)?.projectId || "");
    if (!projectId) return NextResponse.json({ message: "projectId is required" }, { status: 400 });
    const projects = await listVizardProjects();
    const project = projects.find((item) => item.vizardProjectId === projectId);
    if (!project) return NextResponse.json({ message: "Unknown Vizard project" }, { status: 404 });
    const apiKey = process.env.VIZARD_API_KEY?.trim(); if (!apiKey) throw new Error("Vizard is not configured");
    const response = await fetch(`https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/query/${encodeURIComponent(projectId)}`, { headers: { VIZARDAI_API_KEY: apiKey }, cache: "no-store" });
    const result = await response.json() as { code?: number; videos?: Record<string, unknown>[] };
    if (!response.ok || result.code !== 2000 || !result.videos?.length) return NextResponse.json({ accepted: true, status: "processing", code: result.code }, { status: 202 });
    let imported = 0;
    for (const video of result.videos) {
      const videoId = String(value(video, ["videoId", "video_id"]) || ""); const videoUrl = String(video.videoUrl || ""); if (!videoId || !videoUrl) continue;
      const download = await fetch(videoUrl, { cache: "no-store" }); if (!download.ok) throw new Error(`Vizard clip download returned ${download.status}`);
      const bytes = Buffer.from(await download.arrayBuffer()); const storedUrl = await uploadSocialVideo({ fileName: `vizard-${projectId}-${videoId}.mp4`, slug: project.dramaSlug, bytes });
      const asset = await saveVizardAsset({ projectId: project.id, dramaSlug: project.dramaSlug, episodeNumber: project.episodeNumber, vizardVideoId: videoId, title: String(video.title || `${project.projectName} · ${videoId}`), videoUrl: storedUrl, objectKey: storedUrl.split("/").slice(-1)[0] || videoId, durationSeconds: Number(video.videoMsDuration || 0) / 1000, transcript: typeof video.transcript === "string" ? video.transcript : undefined, viralScore: video.viralScore == null ? undefined : String(video.viralScore), viralReason: typeof video.viralReason === "string" ? video.viralReason : undefined, clipEditorUrl: typeof video.clipEditorUrl === "string" ? video.clipEditorUrl : undefined, metadata: video });
      if (asset) imported++;
    }
    await updateVizardProject(project.id, { status: "ready", editInfo: { ...project.editInfo, webhookReceivedAt: new Date().toISOString(), importedAssets: imported, sourcePayload: body } });
    return NextResponse.json({ accepted: true, status: "ready", imported });
  } catch (error) { console.error("[webhook] Vizard import failed", error instanceof Error ? error.message : "unknown"); return NextResponse.json({ message: "Vizard import failed" }, { status: 500 }); }
}
