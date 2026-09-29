import type { LibraryAsset } from "@/lib/admin/asset-library";

export const WEEKLY_PUBLISH_DAYS = 7;
export const WEEKLY_PUBLISH_VIDEOS = 70;
export const WEEKLY_START_DRAMA = "the-triplets-final-regret";
export const WEEKLY_START_EPISODE = 3;

const slotGroups = [
  [0, 1, 5, 6],
  [2, 3, 4],
  [7, 8, 9],
] as const;

export type WeeklyPlanDay = { date: string; assets: LibraryAsset[] };

export function addPacificDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function nextWeeklyStartDate(tomorrow: string, occupiedDates: string[]) {
  const last = occupiedDates.filter((date) => date >= tomorrow).sort().at(-1);
  return last ? addPacificDays(last, 1) : tomorrow;
}

function allocation(remaining: number[]) {
  const selected = remaining.map((count, index) => ({ count, index })).filter((item) => item.count > 0).slice(0, 3);
  if (!selected.length) return [];
  const result = selected.map((item, index) => ({ ...item, take: Math.min(item.count, slotGroups[index]?.length || 3) }));
  let total = result.reduce((sum, item) => sum + item.take, 0);
  while (total < 10) {
    const candidate = result.find((item) => item.take < item.count);
    if (!candidate) break;
    candidate.take += 1;
    total += 1;
  }
  const selectedIndexes = new Set(result.map((item) => item.index));
  for (let index = 0; total < 10 && index < remaining.length; index += 1) {
    if (selectedIndexes.has(index)) continue;
    if (!remaining[index]) continue;
    const take = Math.min(10 - total, remaining[index]);
    result.push({ count: remaining[index], index, take });
    total += take;
  }
  return result;
}

function arrangeDay(groups: Array<{ assets: LibraryAsset[] }>) {
  const arranged: Array<LibraryAsset | undefined> = Array(10);
  const free = () => Array.from({ length: arranged.length }, (_, index) => arranged[index] ? -1 : index).filter((index) => index >= 0);
  groups.forEach((group, groupIndex) => {
    const preferred = [...(slotGroups[groupIndex] || [])].filter((index) => !arranged[index]);
    const positions: number[] = preferred.slice(0, group.assets.length);
    if (positions.length < group.assets.length) {
      const selected = new Set(positions);
      positions.push(...free().filter((index) => !selected.has(index)).slice(0, group.assets.length - positions.length));
    }
    positions.sort((a, b) => a - b);
    const assets = [...group.assets].sort((a, b) => a.episodeNumber - b.episodeNumber);
    positions.forEach((position, index) => { arranged[position] = assets[index]; });
  });
  return arranged.filter((asset): asset is LibraryAsset => Boolean(asset));
}

export function buildWeeklyPlan(assets: LibraryAsset[], startDate: string): WeeklyPlanDay[] {
  if (assets.length < WEEKLY_PUBLISH_VIDEOS) return [];
  const byDrama = new Map<string, LibraryAsset[]>();
  for (const asset of assets) {
    const values = byDrama.get(asset.dramaSlug) || [];
    values.push(asset);
    byDrama.set(asset.dramaSlug, values);
  }
  const dramas = Array.from(byDrama.values()).map((values) => values.sort((a, b) => a.episodeNumber - b.episodeNumber));
  const days: WeeklyPlanDay[] = [];
  for (let day = 0; day < WEEKLY_PUBLISH_DAYS; day += 1) {
    const remaining = dramas.map((values) => values.length);
    const portions = allocation(remaining);
    const groups = portions.map((portion) => ({ assets: dramas[portion.index].splice(0, portion.take) }));
    for (let index = dramas.length - 1; index >= 0; index -= 1) {
      if (!dramas[index].length) dramas.splice(index, 1);
    }
    const arranged = arrangeDay(groups);
    if (arranged.length !== 10) return [];
    days.push({ date: addPacificDays(startDate, day), assets: arranged });
  }
  return days;
}
