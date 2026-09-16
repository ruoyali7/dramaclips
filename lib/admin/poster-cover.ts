const rsCoverHost = "v-img.crazymaplestudios.com";

export function isAllowedPosterCoverUrl(value: string, r2Base = process.env.R2_PUBLIC_BASE_URL || "") {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (url.hostname === rsCoverHost) return true;
    if (!r2Base) return false;
    return url.origin === new URL(r2Base).origin;
  } catch {
    return false;
  }
}

export function posterCoverProxyUrl(value: string) {
  return value.startsWith("/") ? value : `/api/admin/poster-cover?url=${encodeURIComponent(value)}`;
}
