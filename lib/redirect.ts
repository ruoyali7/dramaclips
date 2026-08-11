import { createHash } from "crypto";
import type { Destination } from "./types";

export function detectDevice(ua: string): "ios" | "android" | "universal" { if (/iphone|ipad|ipod/i.test(ua)) return "ios"; if (/android/i.test(ua)) return "android"; return "universal"; }
export function isSafeDestination(destination: Destination, siteHost?: string) {
  try { const u = new URL(destination.url); return u.protocol === "https:" && u.hostname === destination.allowedHost && u.hostname !== siteHost; } catch { return false; }
}
export function selectDestination(items: Destination[], input: { device: string; country?: string; locale?: string; sessionId: string; now?: Date; siteHost?: string }) {
  const now = input.now || new Date();
  const eligible = items.filter(d => d.enabled && isSafeDestination(d, input.siteHost) && (!d.validFrom || new Date(d.validFrom) <= now) && (!d.validUntil || new Date(d.validUntil) > now) && (!d.countries?.length || !!input.country && d.countries.includes(input.country)) && (!d.locales?.length || !!input.locale && d.locales.includes(input.locale)) && (d.appPlatform === "universal" || d.appPlatform === input.device));
  if (!eligible.length) return null;
  const min = Math.min(...eligible.map(d => d.priority)); const tier = eligible.filter(d => d.priority === min); const total = tier.reduce((n,d) => n + d.weight, 0); if (!total) return tier[0];
  let point = parseInt(createHash("sha256").update(input.sessionId).digest("hex").slice(0,8),16) % total;
  return tier.find(d => (point -= d.weight) < 0) || tier[0];
}
