export type Drama = {
  id: string; slug: string; publicCode: string; title: string; hook: string;
  description: string; coverUrl: string; tags: string[]; status: "published" | "paused";
  routeSlug: string; promoCode?: string; accent: string;
};

export type Episode = {
  id: string;
  dramaId: string;
  episodeNumber: number;
  title: string;
  videoUrl: string;
  durationSeconds?: number;
  isPreview: boolean;
};

export type Destination = {
  id: string; routeSlug: string; name: string; appPlatform: "ios" | "android" | "universal";
  url: string; allowedHost: string; enabled: boolean; priority: number; weight: number;
  countries?: string[]; locales?: string[]; validFrom?: string; validUntil?: string;
};
