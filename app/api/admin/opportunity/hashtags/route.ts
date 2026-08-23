import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { computeHashtagPerformance, listHashtagPerformance } from "@/lib/admin/social-post-ingestion";

const querySchema = z.object({ platform: z.string().max(30).optional(), refresh: z.enum(["true", "false"]).optional() });

export async function GET(request: NextRequest) {
  try {
    const query = querySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = query.refresh === "true" ? await computeHashtagPerformance() : await listHashtagPerformance(query.platform);
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load hashtag performance" }, { status: 503 });
  }
}

export async function POST() {
  try { return NextResponse.json({ result: await computeHashtagPerformance() }, { status: 202 }); }
  catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not compute hashtag performance" }, { status: 503 }); }
}
