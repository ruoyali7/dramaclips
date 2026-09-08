import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getDramaBySlug } from "@/lib/catalog";
import { listPublishCartItems, markPublishCartItemScheduled } from "@/lib/admin/publish-cart-repository";
import { createPublishPackage, enqueueYixiaoerPackage, type PublishingPlatform } from "@/lib/admin/publish-repository";
import { getCachedYixiaoerAccounts } from "@/lib/admin/yixiaoer-account-cache";
import { pacificCartDates } from "@/lib/publish-cart-date";
import { availablePacificPublishSlots } from "@/lib/publish-slots";

const platforms = ["tiktok", "instagram", "youtube", "facebook"] as PublishingPlatform[];
const platformNames: Record<string, string> = { tiktok: "tiktok", instagram: "instagram", youtube: "youtube", facebook: "facebook" };
const schema = z.object({ cartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confirm: z.literal(true) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    if (!pacificCartDates().includes(input.cartDate as any)) return NextResponse.json({ message: "Cart date must be today or tomorrow" }, { status: 400 });
    const items = await listPublishCartItems([input.cartDate]);
    if (!items.length) return NextResponse.json({ message: "This publish cart is empty" }, { status: 400 });
    const slots = availablePacificPublishSlots(input.cartDate, items.length);
    const cache = await getCachedYixiaoerAccounts();
    if (!cache) return NextResponse.json({ message: "Yixiaoer account cache is unavailable" }, { status: 503 });
    const accounts = Object.fromEntries(platforms.map((platform) => {
      const account = cache.accounts.find((item) => item.status === 1 && item.platform.toLowerCase() === platformNames[platform]);
      if (!account) throw new Error(`No active default Yixiaoer account for ${platform}`);
      return [platform, account.id];
    }));
    const dramas = new Map<string, NonNullable<Awaited<ReturnType<typeof getDramaBySlug>>>>();
    for (const item of items) {
      const drama = await getDramaBySlug(item.dramaSlug);
      if (!drama) return NextResponse.json({ message: `Published drama not found: ${item.dramaTitle}` }, { status: 404 });
      dramas.set(item.dramaSlug, drama);
    }
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const scheduled = [];
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const drama = dramas.get(item.dramaSlug)!;
      const packageItem = await createPublishPackage({
        cartItemId: item.id, dramaSlug: item.dramaSlug, title: drama.title,
        promoCode: drama.promoCode || drama.publicCode, contentPromotionUrl: drama.contentPromotionUrl,
        description: drama.description, tags: drama.tags, episodeNumber: item.episodeNumber,
        videoUrl: item.videoUrl, videoKind: "hook", videoLabel: item.title,
        hookClipId: item.assetSource === "hook_clip" ? item.assetId : undefined,
        deliveryMode: "scheduled", scheduledAt: slots[index], platforms, siteUrl,
      });
      const queued = packageItem.status === "scheduled"
        ? packageItem
        : await enqueueYixiaoerPackage(packageItem.id, { action: "publish", accounts, scheduledAt: slots[index] });
      await markPublishCartItemScheduled(item.id, queued.id);
      scheduled.push(queued);
    }
    return NextResponse.json({ packages: scheduled, cartDate: input.cartDate }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not schedule publish cart";
    return NextResponse.json({ message }, { status: error instanceof ZodError || message.includes("future publish slots") ? 400 : 503 });
  }
}
