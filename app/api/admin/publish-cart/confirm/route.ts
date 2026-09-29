import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { pacificCartDates } from "@/lib/publish-cart-date";
import { schedulePublishCartDate } from "@/lib/admin/publish-cart-scheduler";

const schema = z.object({ cartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), confirm: z.literal(true) });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    if (!pacificCartDates().includes(input.cartDate as any)) return NextResponse.json({ message: "Cart date must be today or tomorrow" }, { status: 400 });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const result = await schedulePublishCartDate(input.cartDate, siteUrl);
    return NextResponse.json(result, { status: result.failures.length ? 207 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not schedule publish cart";
    return NextResponse.json({ message }, { status: error instanceof ZodError || message.includes("publish slots") ? 400 : 503 });
  }
}
