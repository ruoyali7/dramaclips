const SAFE = /[^a-zA-Z0-9._-]/g;
const KEYS = { source: ["s", "utm_source"], medium: ["m", "utm_medium"], campaign: ["c", "utm_campaign"], clip: ["cl", "utm_content"], account: ["a", "account"], variant: ["v", "variant"], hook: ["h", "utm_term"] } as const;

export type Tracking = Record<keyof typeof KEYS, string>;
export function normalize(value: string | null | undefined, fallback = "unknown") { return (value || fallback).slice(0, 100).replace(SAFE, "_").toLowerCase(); }
export function parseTracking(params: URLSearchParams, defaults: Partial<Tracking> = {}): Tracking {
  return Object.fromEntries(Object.entries(KEYS).map(([name, aliases]) => {
    const found = aliases.map(k => params.get(k)).find(Boolean);
    return [name, normalize(found, defaults[name as keyof Tracking] || (name === "source" ? "direct" : "unknown"))];
  })) as Tracking;
}
export function trackingQuery(params: Record<string, string | string[] | undefined>) {
  const q = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (typeof v === "string" && v.length <= 200) q.set(k, v); }); return q.toString();
}
