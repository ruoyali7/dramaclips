import { enqueueVizardSubmissions } from "./vizard-repository";

export async function queueDramaEpisodes(drama: { id: string; slug: string; title: string; language: string }, episodes: { episodeNumber: number; videoUrl: string }[]) {
  try {
    const jobs = episodes.length ? await enqueueVizardSubmissions(episodes.map(episode => ({dramaId:drama.id,dramaSlug:drama.slug,episodeNumber:episode.episodeNumber,projectName:`${drama.title} - EP ${episode.episodeNumber}`,videoUrl:episode.videoUrl,settings:{language:drama.language,preferLength:0,maxClipNumber:1,ratio:1,subtitles:false,headline:true,clipModel:"clip_v1"}}))) : [];
    return { status: "queued" as const, requested: episodes.length, accepted: jobs.length };
  } catch (error) {
    console.error("[admin] drama queue failed", error instanceof Error ? error.message : "unknown");
    return { status: "failed" as const, requested: episodes.length, accepted: 0, message: "Could not queue episodes. Your drama is saved; retry queueing below." };
  }
}
