import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { scheduleNextPublishWeek, weeklyPublishStatus } from "@/lib/admin/weekly-publish-service";

export const maxDuration = 300;

export async function GET() {
  try { return NextResponse.json({ plan: await weeklyPublishStatus() }); }
  catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Could not load weekly schedule" }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  try {
    const input = z.object({ action: z.enum(["schedule", "resume"]) }).parse(await request.json());
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    const result = await scheduleNextPublishWeek(siteUrl, input.action);
    return NextResponse.json(result, { status: result.plan.status === "paused" ? 202 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not schedule the next seven days";
    const status = error instanceof ZodError || message.includes("paused") || message.includes("already") ? 409 : 503;
    return NextResponse.json({ message }, { status });
  }
}
