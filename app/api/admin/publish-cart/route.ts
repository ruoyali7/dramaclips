import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { listLibraryAssets } from "@/lib/admin/asset-library";
import { addPublishCartItem, listPublishCartItems, removePublishCartItem, reorderPublishCartItems } from "@/lib/admin/publish-cart-repository";
import { pacificCartDates } from "@/lib/publish-cart-date";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
function allowedDate(value: string) { if (!pacificCartDates().includes(value as any)) throw new Error("Cart date must be today or tomorrow"); return value; }
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Could not update publish cart";
  const status = error instanceof ZodError || message.includes("must be") || message.includes("limited") || message.includes("changed") ? 400 : 503;
  return NextResponse.json({ message }, { status });
}
export async function GET() { try { const dates = [...pacificCartDates()]; const [items, scheduledItems] = await Promise.all([listPublishCartItems(dates), listPublishCartItems(dates, ["scheduled"])]); return NextResponse.json({ dates, items, scheduledItems }); } catch (error) { return failure(error); } }
export async function POST(request: NextRequest) { try {
  const input = z.object({ cartDate: dateSchema, assetId: z.string().min(1).max(200) }).parse(await request.json());
  allowedDate(input.cartDate);
  const asset = (await listLibraryAssets()).find((item) => item.id === input.assetId && item.kind === "hook");
  if (!asset || asset.source === "episode") return NextResponse.json({ message: "Saved Hook asset not found" }, { status: 404 });
  return NextResponse.json({ item: await addPublishCartItem(input.cartDate, asset) }, { status: 201 });
} catch (error) { return failure(error); } }
export async function PATCH(request: NextRequest) { try {
  const input = z.object({ cartDate: dateSchema, itemIds: z.array(z.string().uuid()).max(10) }).parse(await request.json());
  allowedDate(input.cartDate); return NextResponse.json({ items: await reorderPublishCartItems(input.cartDate, input.itemIds) });
} catch (error) { return failure(error); } }
export async function DELETE(request: NextRequest) { try {
  const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id")); await removePublishCartItem(id);
  return new NextResponse(null, { status: 204 });
} catch (error) { return failure(error); } }
