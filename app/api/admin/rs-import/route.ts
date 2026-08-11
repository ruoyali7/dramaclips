import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { importFromRs } from "@/lib/admin/rs-import";

const schema = z.object({ link: z.string().url().optional(), detailsText: z.string().max(20000).optional() }).refine((input) => Boolean(input.link || input.detailsText?.trim()), "Paste RS page text or a detail link");
export async function POST(request: NextRequest) {
  try { const input = schema.parse(await request.json()); return NextResponse.json({ drama: await importFromRs(input.link, input.detailsText) }); }
  catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Paste a valid RS Boost detail link" }, { status: 400 });
    const code = (error as Error & { code?: string }).code;
    return NextResponse.json({ code, message: error instanceof Error ? error.message : "Could not import RS details" }, { status: code?.startsWith("RS_CONNECTION") ? 409 : 502 });
  }
}
