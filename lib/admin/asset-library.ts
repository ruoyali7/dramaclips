import "server-only";
import { listVizardSources } from "./repository";
import { listHookClips, type HookClip } from "./hook-repository";
import { listPublishedAssetIdentities, listPublishPackages } from "./publish-repository";
import { listVizardAssets, type VizardAsset } from "./vizard-repository";

export type LibraryAsset = {
  id: string;
  source: "episode" | "hook_clip" | "vizard";
  kind: "original" | "hook";
  dramaId: string;
  dramaSlug: string;
  dramaTitle: string;
  coverUrl: string;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  durationSeconds: number;
  hook?: { id: string; text: string; status: "saved" | "approved" };
  publishing: {
    status: "never" | "ready" | "scheduled" | "publishing" | "published" | "failed";
    latestPackageId?: string;
  };
  createdAt: string;
};

export function publishStatus(packages: Awaited<ReturnType<typeof listPublishPackages>>, publishedAssets: Awaited<ReturnType<typeof listPublishedAssetIdentities>>, id: string, url: string) {
  if (publishedAssets.some((item) => (id && item.hookClipId === id) || item.videoUrl === url)) {
    const published = packages.find((item) => item.status === "published" && ((id && item.hookClipId === id) || item.videoUrl === url));
    return { status: "published" as const, latestPackageId: published?.id };
  }
  const relevant = packages.filter((item) => item.hookClipId === id || item.videoUrl === url);
  for (const status of ["published", "publishing", "scheduled", "failed"] as const) {
    const match = relevant.find((item) => item.status === status);
    if (match) return { status, latestPackageId: match.id };
  }
  const latest = relevant[0];
  return latest ? { status: "ready" as const, latestPackageId: latest.id } : { status: "never" as const };
}

export async function listLibraryAssets(): Promise<LibraryAsset[]> {
  const [sources, hooks, vizardAssets, packages, publishedAssets] = await Promise.all([
    listVizardSources(),
    listHookClips(),
    listVizardAssets(),
    listPublishPackages(),
    listPublishedAssetIdentities(),
  ]);
  const sourceMap = new Map(sources.map((source) => [source.slug, source]));
  const result: LibraryAsset[] = [];
  for (const source of sources) {
    for (const episode of source.episodes) {
      result.push({
        id: `original:${source.slug}:${episode.episodeNumber}`,
        source: "episode",
        kind: "original",
        dramaId: source.id,
        dramaSlug: source.slug,
        dramaTitle: source.title,
        coverUrl: source.coverUrl,
        episodeNumber: episode.episodeNumber,
        title: `Episode ${episode.episodeNumber}`,
        videoUrl: episode.videoUrl,
        durationSeconds: 0,
        publishing: publishStatus(packages, publishedAssets, "", episode.videoUrl),
        createdAt: "",
      });
    }
  }
  for (const hook of hooks) {
    const source = sourceMap.get(hook.dramaSlug);
    if (source) result.push(fromHook(hook, source, packages, publishedAssets));
  }
  for (const asset of vizardAssets.filter((item) => item.reviewState === "approved")) {
    const source = sourceMap.get(asset.dramaSlug);
    if (source) result.push(fromVizard(asset, source, packages, publishedAssets));
  }
  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function fromHook(hook: HookClip, source: { id: string; title: string; slug: string; coverUrl: string }, packages: Awaited<ReturnType<typeof listPublishPackages>>, publishedAssets: Awaited<ReturnType<typeof listPublishedAssetIdentities>>): LibraryAsset {
  return { id: hook.id, source: "hook_clip", kind: "hook", dramaId: source.id, dramaSlug: source.slug, dramaTitle: source.title, coverUrl: source.coverUrl, episodeNumber: hook.sourceEpisodes[0] || 0, title: hook.title, videoUrl: hook.videoUrl, durationSeconds: hook.durationSeconds, hook: { id: hook.id, text: hook.title, status: "saved" }, publishing: publishStatus(packages, publishedAssets, hook.id, hook.videoUrl), createdAt: hook.createdAt };
}

function fromVizard(asset: VizardAsset, source: { id: string; title: string; slug: string; coverUrl: string }, packages: Awaited<ReturnType<typeof listPublishPackages>>, publishedAssets: Awaited<ReturnType<typeof listPublishedAssetIdentities>>): LibraryAsset {
  return { id: asset.id, source: "vizard", kind: "hook", dramaId: source.id, dramaSlug: source.slug, dramaTitle: source.title, coverUrl: source.coverUrl, episodeNumber: asset.episodeNumber, title: asset.title, videoUrl: asset.videoUrl, durationSeconds: asset.durationSeconds, hook: { id: asset.id, text: asset.title, status: "approved" }, publishing: publishStatus(packages, publishedAssets, asset.id, asset.videoUrl), createdAt: asset.createdAt };
}
