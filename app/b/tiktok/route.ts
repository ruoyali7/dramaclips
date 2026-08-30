import { NextResponse } from "next/server";

// Stable account-level entry point for the TikTok profile bio.
export function GET(request: Request) {
  const url = new URL("/", request.url);
  url.searchParams.set("s", "tiktok");
  url.searchParams.set("a", "tiktok-bio");
  url.searchParams.set("c", "bio");
  url.searchParams.set("cl", "profile");
  return NextResponse.redirect(url, 302);
}
