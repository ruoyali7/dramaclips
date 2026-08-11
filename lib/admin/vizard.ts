import "server-only";

export type VizardInput = {
  projectName: string;
  videoUrl: string;
  language: string;
  preferLength: number;
  maxClipNumber: number;
  ratio: number;
  subtitles: boolean;
  headline: boolean;
  clipModel: "clip_v1" | "clip_v2";
};

export async function submitToVizard(input: VizardInput) {
  const apiKey = process.env.VIZARD_API_KEY?.trim();
  if (!apiKey) throw new Error("Vizard is not configured");
  const response = await fetch("https://elb-api.vizard.ai/hvizard-server-front/open-api/v1/project/create", {
    method: "POST",
    headers: { "Content-Type": "application/json", VIZARDAI_API_KEY: apiKey },
    body: JSON.stringify({
      lang: input.language || "auto",
      videoUrl: input.videoUrl,
      videoType: 1,
      ext: new URL(input.videoUrl).pathname.split(".").pop()?.toLowerCase() || "mp4",
      getClips: 1,
      ratioOfClip: input.ratio,
      subtitleSwitch: input.subtitles ? 1 : 0,
      headlineSwitch: input.headline ? 1 : 0,
      emojiSwitch: 0,
      highlightSwitch: 0,
      autoBrollSwitch: 0,
      removeSilenceSwitch: 0,
      preferLength: [input.preferLength],
      maxClipNumber: input.maxClipNumber,
      clipModel: input.clipModel,
      projectName: input.projectName,
    }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { code?: number; errMsg?: string; projectId?: string | number };
  if (!response.ok || data.code !== 2000) {
    const error = new Error(data.errMsg || `Vizard request failed (${response.status})`) as Error & { retryable?: boolean };
    error.retryable = data.code === 4003 || response.status === 429;
    throw error;
  }
  return { projectId: String(data.projectId || ""), status: "submitted" as const };
}
