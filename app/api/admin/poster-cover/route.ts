import { NextRequest, NextResponse } from "next/server";
import { isAllowedPosterCoverUrl } from "@/lib/admin/poster-cover";

const maxCoverBytes = 20 * 1024 * 1024;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!isAllowedPosterCoverUrl(url)) return NextResponse.json({ message: "Cover URL is not allowed" }, { status: 400 });
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "error" });
    if (!response.ok) return NextResponse.json({ message: `Cover source returned ${response.status}` }, { status: 502 });
    const contentType = response.headers.get("content-type") || "";
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (!contentType.startsWith("image/")) return NextResponse.json({ message: "Cover source did not return an image" }, { status: 502 });
    if (contentLength > maxCoverBytes) return NextResponse.json({ message: "Cover exceeds the 20 MB limit" }, { status: 413 });
    const body = await response.arrayBuffer();
    if (body.byteLength > maxCoverBytes) return NextResponse.json({ message: "Cover exceeds the 20 MB limit" }, { status: 413 });
    return new NextResponse(body, { headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ message: "Cover source could not be loaded" }, { status: 502 });
  }
}
