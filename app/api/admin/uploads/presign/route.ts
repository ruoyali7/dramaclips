import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createR2Upload } from "@/lib/admin/r2";

const schema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.string().trim().min(1).max(100),
  size: z.number().int().positive(),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  kind: z.enum(["episode", "cover", "social"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(createR2Upload(schema.parse(await request.json())));
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ message: "Check the selected file and drama slug" }, { status: 400 });
    console.error("[admin] R2 presign failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not prepare upload" }, { status: 500 });
  }
}
