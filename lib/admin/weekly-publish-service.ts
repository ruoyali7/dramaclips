import "server-only";
import { listLibraryAssets } from "./asset-library";
import { addPublishCartItem, listActivePublishCartItemsFrom } from "./publish-cart-repository";
import { schedulePublishCartDate } from "./publish-cart-scheduler";
import { listPublishPackages } from "./publish-repository";
import { createWeeklyPublishPlan, getLatestWeeklyPublishPlan, updateWeeklyPublishPlan } from "./weekly-publish-repository";
import { triggerRailwayWorker } from "./railway-worker-trigger";
import { pacificCartDates } from "@/lib/publish-cart-date";
import { addPacificDays, buildWeeklyPlan, nextWeeklyStartDate, WEEKLY_PUBLISH_VIDEOS, WEEKLY_START_DRAMA, WEEKLY_START_EPISODE } from "@/lib/weekly-publish-plan";

export async function weeklyPublishStatus() {
  return getLatestWeeklyPublishPlan();
}

async function eligibleOriginalAssets() {
  const [assets, packages] = await Promise.all([listLibraryAssets(), listPublishPackages()]);
  const usedUrls = new Set(packages.filter((item) => item.videoKind === "original").map((item) => item.videoUrl));
  const originals = assets.filter((asset) => asset.kind === "original" && !usedUrls.has(asset.videoUrl));
  const dramaOrder = new Map<string, number>();
  const threshold = assets.find((asset) => asset.kind === "original" && asset.dramaSlug === WEEKLY_START_DRAMA);
  if (!threshold) throw new Error("The Triplets' Final Regret is not available in Drama Library");
  const allDramaOrder = Array.from(new Map(assets.filter((asset) => asset.kind === "original").map((asset) => [asset.dramaSlug, asset.dramaPublishedAt || ""])).entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([slug]) => slug);
  allDramaOrder.forEach((slug, index) => dramaOrder.set(slug, index));
  const startIndex = dramaOrder.get(WEEKLY_START_DRAMA);
  return originals
    .filter((asset) => {
      const index = dramaOrder.get(asset.dramaSlug);
      return index != null && startIndex != null && index >= startIndex && (asset.dramaSlug !== WEEKLY_START_DRAMA || asset.episodeNumber >= WEEKLY_START_EPISODE);
    })
    .sort((a, b) => (dramaOrder.get(a.dramaSlug)! - dramaOrder.get(b.dramaSlug)!) || a.episodeNumber - b.episodeNumber);
}

export async function scheduleNextPublishWeek(siteUrl: string, action: "schedule" | "resume") {
  const latest = await getLatestWeeklyPublishPlan();
  if (action === "schedule" && latest?.status === "paused") {
    throw new Error("Weekly scheduling is paused; add original videos and use Resume weekly schedule");
  }
  if (latest?.status === "planning") throw new Error("A weekly schedule is already being created");
  const tomorrow = pacificCartDates()[1];
  const activeCart = await listActivePublishCartItemsFrom(tomorrow);
  const startDate = nextWeeklyStartDate(tomorrow, activeCart.map((item) => item.cartDate));
  const endDate = addPacificDays(startDate, 6);
  const activeAssetIds = new Set(activeCart.map((item) => item.assetId));
  const eligible = (await eligibleOriginalAssets()).filter((asset) => !activeAssetIds.has(asset.id));
  const available = eligible.length;
  const missing = Math.max(0, WEEKLY_PUBLISH_VIDEOS - available);
  let run = action === "resume" && latest?.status === "paused"
    ? await updateWeeklyPublishPlan(latest.id, { status: missing ? "paused" : "planning", startDate, endDate, availableVideos: available, missingVideos: missing, scheduledVideos: 0, nextDramaSlug: eligible[0]?.dramaSlug, nextEpisodeNumber: eligible[0]?.episodeNumber, errorMessage: undefined })
    : await createWeeklyPublishPlan({ status: missing ? "paused" : "planning", startDate, endDate, requiredVideos: WEEKLY_PUBLISH_VIDEOS, availableVideos: available, missingVideos: missing, scheduledVideos: 0, nextDramaSlug: eligible[0]?.dramaSlug, nextEpisodeNumber: eligible[0]?.episodeNumber });
  if (missing) {
    const workerTrigger = await triggerRailwayWorker("publish");
    return { plan: run, workerTrigger };
  }
  const plan = buildWeeklyPlan(eligible, startDate);
  if (plan.length !== 7) throw new Error("Could not build a complete seven-day publish plan");
  let scheduledVideos = 0;
  try {
    for (const day of plan) {
      for (const asset of day.assets) await addPublishCartItem(day.date, asset);
      const result = await schedulePublishCartDate(day.date, siteUrl);
      scheduledVideos += result.packages.length;
      run = await updateWeeklyPublishPlan(run.id, { scheduledVideos });
      if (result.failures.length) throw new Error(`${result.failures.length} videos stayed in Cart on ${day.date}`);
    }
    run = await updateWeeklyPublishPlan(run.id, { status: "scheduled", scheduledVideos, missingVideos: 0, errorMessage: undefined });
    return { plan: run };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Weekly scheduling failed";
    await updateWeeklyPublishPlan(run.id, { status: "failed", scheduledVideos, errorMessage: message });
    throw error;
  }
}
