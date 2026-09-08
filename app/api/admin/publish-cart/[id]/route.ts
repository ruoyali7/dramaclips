import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { cancelPublishCartItem, getPublishCartItem } from "@/lib/admin/publish-cart-repository";
import { getPublishPackage, requestCancelYixiaoerPackage } from "@/lib/admin/publish-repository";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const input = z.object({ action: z.literal("cancel") }).parse(await request.json()); void input;
    const { id } = await params; const item = await getPublishCartItem(id);
    if (!item || item.status !== "scheduled" || !item.publishPackageId) return NextResponse.json({ message: "Scheduled cart item not found" }, { status: 404 });
    const packageItem = await getPublishPackage(item.publishPackageId);
    if (!packageItem) return NextResponse.json({ message: "Publish package not found" }, { status: 404 });
    if (packageItem.status !== "scheduled") return NextResponse.json({ message: "Only a publish that has not started can be canceled here" }, { status: 409 });
    const canceledPackage = await requestCancelYixiaoerPackage(packageItem.id);
    const canceledItem = await cancelPublishCartItem(item.id);
    console.info("[publish-cart] scheduled item canceled", { cartItemId: item.id, publishPackageId: packageItem.id });
    return NextResponse.json({ item: canceledItem, package: canceledPackage });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Unsupported cart action" }, { status: 400 });
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not cancel scheduled item" }, { status: 503 });
  }
}
