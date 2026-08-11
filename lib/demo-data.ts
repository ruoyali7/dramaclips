import type { Destination, Drama, Episode } from "./types";

export const dramas: Drama[] = [
  { id: "d1", slug: "traded-my-wolves-for-a-snake", publicCode: "3469908", title: "Traded My Wolves for a Snake", hook: "She traded three wolves who betrayed her for the one cold-blooded snake who stayed.", description: "Cora raised three wounded wolves, only to watch them turn cold when her sister Vivian appeared. She offered a trade: three wolves for Vivian's snake. Silas was ice-cold, yet he stayed—doing chores, guarding her, and following her all the way to the airport when she fled an arranged marriage. The cold snake proved truer than any wolf.", coverUrl: "/covers/traded-my-wolves-for-a-snake.jpg", tags: ["Hidden strength", "Werewolf"], status: "published", routeSlug: "traded-wolves-snake", promoCode: "3469908", accent: "#8f574c" },
  { id: "d2", slug: "moonlit-revenge", publicCode: "1028", title: "Moonlit Revenge", hook: "They took everything from her. They forgot she would come back.", description: "Presumed dead after a family betrayal, Mira returns under a new name to reclaim her life—and the man she never stopped loving.", coverUrl: "https://images.unsplash.com/photo-1518568740560-333139a27e72?auto=format&fit=crop&w=900&q=85", tags: ["Revenge", "Second chance"], status: "published", routeSlug: "moonlit-revenge", promoCode: "MOON28", accent: "#716078" },
  { id: "d3", slug: "the-runaway-heiress", publicCode: "7813", title: "The Runaway Heiress", hook: "Her family planned her future. She chose the one man they feared.", description: "On the eve of an arranged engagement, an heiress disappears into the city and finds freedom where she least expects it.", coverUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=900&q=85", tags: ["Hidden identity", "Drama"], status: "published", routeSlug: "runaway-heiress", promoCode: "RUN13", accent: "#8f574c" },
  { id: "d4", slug: "contracted-hearts", publicCode: "3307", title: "Contracted Hearts", hook: "The contract said no feelings. Nobody warned their hearts.", description: "A practical arrangement between two rivals turns dangerously real under the world's watchful eye.", coverUrl: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85", tags: ["Contract love", "Slow burn"], status: "published", routeSlug: "contracted-hearts", promoCode: "HEART7", accent: "#b48b5c" }
];

export const destinations: Destination[] = [
  { id: "dest-rs-wolves", routeSlug: "traded-wolves-snake", name: "ReelShort — Traded My Wolves for a Snake", appPlatform: "universal", url: process.env.RS_TRADED_WOLVES_CPS_URL || "https://reelslink.example.test/cps/RESOURCE_PLACEHOLDER", allowedHost: process.env.RS_TRADED_WOLVES_CPS_URL ? "reelslink.com" : "reelslink.example.test", enabled: true, priority: 10, weight: 100 },
  ...["moonlit-revenge", "runaway-heiress", "contracted-hearts"].map((routeSlug, i) => ({ id: `dest-${i + 4}`, routeSlug, name: "DramaBox Universal", appPlatform: "universal" as const, url: `https://affiliate.example.test/cps/RESOURCE_${i + 2}_PLACEHOLDER`, allowedHost: "affiliate.example.test", enabled: true, priority: 100, weight: 100 }))
];

export const defaultLanding = { slug: "featured", title: "Tonight's obsession", subtitle: "Handpicked stories with twists you won't see coming.", heroDramaId: "d1", dramaIds: ["d1", "d2", "d3", "d4"] };

// CC0 demo asset only. Replace each URL with the corresponding authorized RS Boost/R2 object.
const DEMO_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
const WOLVES_EPISODES = [
  "https://pub-65eeb3b6ecc44720ba440ea8c8454185.r2.dev/vizard-batch/ff7c810745b6-Traded%20My%20Wolves%20for%20a%20Snake%20EP%201.mp4",
  "https://pub-65eeb3b6ecc44720ba440ea8c8454185.r2.dev/vizard-batch/90aa1a5c93d5-Traded%20My%20Wolves%20for%20a%20Snake%20EP%202.mp4",
  "https://pub-65eeb3b6ecc44720ba440ea8c8454185.r2.dev/vizard-batch/8a4a1ba5efe9-Traded%20My%20Wolves%20for%20a%20Snake%20EP%203.mp4",
  "https://pub-65eeb3b6ecc44720ba440ea8c8454185.r2.dev/vizard-batch/6034802205d1-Traded%20My%20Wolves%20for%20a%20Snake%20EP%204.mp4",
  "https://pub-65eeb3b6ecc44720ba440ea8c8454185.r2.dev/vizard-batch/4359eb07ddaf-Traded%20My%20Wolves%20for%20a%20Snake%20EP%205.mp4"
];
export const episodes: Episode[] = dramas.flatMap((drama) => (drama.id === "d1" ? [1,2,3,4,5] : [1, 2, 3]).map((episodeNumber) => ({
  id: `${drama.id}-e${episodeNumber}`,
  dramaId: drama.id,
  episodeNumber,
  title: `Chapter ${episodeNumber}`,
  videoUrl: drama.id === "d1" ? WOLVES_EPISODES[episodeNumber - 1] : DEMO_VIDEO,
  durationSeconds: drama.id === "d1" ? 98 : 30,
  isPreview: true
})));

export function getEpisodes(dramaId: string) { return episodes.filter(item => item.dramaId === dramaId).sort((a,b) => a.episodeNumber - b.episodeNumber); }
export function findDrama(value: string) {
  const q = value.trim().toLowerCase();
  return dramas.find(d => d.publicCode.toLowerCase() === q || d.promoCode?.toLowerCase() === q || d.slug === q)
    || dramas.find(d => d.title.toLowerCase().includes(q) || d.tags.some(tag => tag.toLowerCase().includes(q)));
}
