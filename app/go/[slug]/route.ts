import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getRedirectConfig } from "@/lib/catalog";
import { detectDevice, selectDestination } from "@/lib/redirect";
import { parseTracking } from "@/lib/tracking";
import { recordTrackingEvent } from "@/lib/admin/analytics-repository";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const started = Date.now();
  const { slug } = await params;
  const config = await getRedirectConfig(slug);
  const drama = config?.drama;
  const responseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" };

  if (!drama) {
    return NextResponse.redirect(new URL(`/go/${slug}/fallback?reason=route_unavailable`, request.url), { status: 302, headers: responseHeaders });
  }

  const sessionId = request.cookies.get("db_session")?.value || randomUUID();
  const device = detectDevice(request.headers.get("user-agent") || "");
  const destination = selectDestination(config?.destinations || [], {
    device,
    sessionId,
    country: request.headers.get("x-vercel-ip-country") || undefined,
    locale: request.headers.get("accept-language")?.split(",")[0],
    siteHost: request.nextUrl.hostname
  });

  if (!destination) {
    return NextResponse.redirect(new URL(`/go/${slug}/fallback?reason=no_destination`, request.url), { status: 302, headers: responseHeaders });
  }

  const tracking = parseTracking(request.nextUrl.searchParams);
  const click = {
    publicClickId: randomUUID().replaceAll("-", ""), occurredAt: new Date().toISOString(), sessionId,
    routeSlug: slug, dramaId: drama.id, destinationId: destination.id,
    tracking, device, outcome: "redirect_success", latencyMs: Date.now() - started
  };
  // A production adapter writes this record to Supabase. Never log the destination URL.
  if (process.env.NODE_ENV === "development") console.info("[redirect]", JSON.stringify(click));
  try { await recordTrackingEvent({name:"redirect_success",sessionId,dramaId:drama.id,dramaSlug:drama.slug,shortCode:request.nextUrl.searchParams.get("sl")||undefined,source:tracking.source,account:tracking.account,campaign:tracking.campaign,clip:tracking.clip,device,metadata:{outcome:"redirect_success"}}); } catch { /* Redirect remains available if analytics is unavailable. */ }

  const response = NextResponse.redirect(destination.url, { status: 302, headers: responseHeaders });
  response.cookies.set("db_session", sessionId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return response;
}
