export type ClientEventName =
  | "page_view"
  | "episode_start"
  | "episode_complete"
  | "next_episode"
  | "promo_code_copy"
  | "rs_redirect_click";

type ClientEvent = {
  dramaId: string;
  dramaSlug?: string;
  episodeId?: string;
  episodeNumber?: number;
  fromEpisode?: number;
  toEpisode?: number;
  position?: string;
  metadata?: Record<string, unknown>;
};

export function trackClientEvent(name: ClientEventName, event: ClientEvent) {
  const body = JSON.stringify({
    eventId: crypto.randomUUID(),
    name,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    tracking: Object.fromEntries(new URLSearchParams(window.location.search)),
    ...event
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
    return;
  }
  void fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true
  }).catch(() => undefined);
}
