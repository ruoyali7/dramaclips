export function isReadyDramaVideo(value: string, publicBase?: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || ["v-mps.crazymaplestudios.com", "v-out.oss-accelerate.aliyuncs.com"].includes(url.hostname)) return false;
    if (!publicBase) return true;
    const base = new URL(publicBase);
    return url.origin === base.origin && url.pathname.startsWith(`${base.pathname.replace(/\/$/, "")}/`);
  } catch { return false; }
}

export function nextEpisodeNumber(episodes: { episodeNumber: number }[]) {
  return Math.max(0, ...episodes.map(episode => episode.episodeNumber)) + 1;
}
