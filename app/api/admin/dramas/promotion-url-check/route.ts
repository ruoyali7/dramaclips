import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dramaDraftSchema } from "@/lib/admin/drama-schema";
import { findPromotionUrlConflict } from "@/lib/admin/repository";

const inputSchema = z.object({ url: dramaDraftSchema.shape.cpsUrl, excludeId: z.string().optional() });

export async function POST(request: NextRequest) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Enter a valid ReelShort promotion URL." }, { status: 400 });
  const conflict = await findPromotionUrlConflict(parsed.data.url, parsed.data.excludeId);
  return NextResponse.json(conflict ? { exists: true, dramaTitle: conflict.title } : { exists: false });
}
