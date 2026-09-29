import "server-only";
import { getDramaBySlug } from "@/lib/catalog";
import { futurePacificPublishSlots } from "@/lib/publish-slots";
import { listPublishCartItems, markPublishCartItemScheduled } from "./publish-cart-repository";
import { createPublishPackage, enqueueYixiaoerPackage, getPublishPackage, publishingPlatformsForVideoKind, type PublishingPlatform } from "./publish-repository";
import { getCachedYixiaoerAccounts } from "./yixiaoer-account-cache";

const platforms = ["tiktok", "instagram", "youtube", "facebook"] as PublishingPlatform[];
const platformNames: Record<string, string> = { tiktok: "tiktok", instagram: "instagram", youtube: "youtube", facebook: "facebook" };

export async function schedulePublishCartDate(cartDate: string, siteUrl: string) {
  const items = await listPublishCartItems([cartDate]);
  if (!items.length) throw new Error("This publish cart is empty");
  const scheduledItems = await listPublishCartItems([cartDate], ["scheduled"]);
  const scheduledPackages = await Promise.all(scheduledItems.map((item) => item.publishPackageId ? getPublishPackage(item.publishPackageId) : null));
  const occupied = new Set(scheduledItems.map((item, index) => item.scheduledAt || scheduledPackages[index]?.scheduledAt).filter(Boolean));
  const slots = futurePacificPublishSlots(cartDate).filter((slot) => !occupied.has(slot)).slice(0, items.length);
  if (slots.length < items.length) throw new Error(`Only ${slots.length} unoccupied future publish slots remain for ${cartDate}`);
  const cache = await getCachedYixiaoerAccounts();
  if (!cache) throw new Error("Yixiaoer account cache is unavailable");
  const availableAccounts = Object.fromEntries(platforms.map((platform) => {
    const account = cache.accounts.find((item) => item.status === 1 && item.platform.toLowerCase() === platformNames[platform]);
    return [platform, account?.id];
  }));
  const dramas = new Map<string, NonNullable<Awaited<ReturnType<typeof getDramaBySlug>>>>();
  for (const item of items) {
    const drama = await getDramaBySlug(item.dramaSlug);
    if (!drama) throw new Error(`Published drama not found: ${item.dramaTitle}`);
    dramas.set(item.dramaSlug, drama);
  }
  const scheduled = []; const failures: Array<{ cartItemId: string; title: string; message: string }> = [];
  console.info("[publish-cart] scheduling started", { cartDate, count: items.length });
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index]; const drama = dramas.get(item.dramaSlug)!;
    try {
      const videoKind = item.assetSource === "episode" ? "original" : "hook";
      const itemPlatforms = publishingPlatformsForVideoKind(videoKind, platforms);
      const accounts = Object.fromEntries(itemPlatforms.map((platform) => {
        const accountId = availableAccounts[platform];
        if (!accountId) throw new Error(`No active default Yixiaoer account for ${platform}`);
        return [platform, accountId];
      }));
      const packageItem = await createPublishPackage({
        cartItemId: item.id, dramaSlug: item.dramaSlug, title: drama.title,
        promoCode: drama.promoCode || drama.publicCode, contentPromotionUrl: drama.contentPromotionUrl,
        description: drama.description, tags: drama.tags, episodeNumber: item.episodeNumber,
        videoUrl: item.videoUrl, videoKind, videoLabel: item.title,
        hookClipId: item.assetSource === "hook_clip" ? item.assetId : undefined,
        deliveryMode: "scheduled", scheduledAt: slots[index], platforms: itemPlatforms, siteUrl,
      });
      const effectiveSlot = packageItem.status === "scheduled" && packageItem.scheduledAt ? packageItem.scheduledAt : slots[index];
      const queued = packageItem.status === "scheduled" ? packageItem : await enqueueYixiaoerPackage(packageItem.id, { action: "publish", accounts, scheduledAt: effectiveSlot });
      await markPublishCartItemScheduled(item.id, queued.id, effectiveSlot);
      scheduled.push(queued);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not schedule item";
      failures.push({ cartItemId: item.id, title: item.title, message });
      console.error("[publish-cart] item failed", { cartDate, cartItemId: item.id, message });
    }
  }
  console.info("[publish-cart] scheduling finished", { cartDate, scheduled: scheduled.length, failed: failures.length });
  return { packages: scheduled, failures, cartDate };
}
