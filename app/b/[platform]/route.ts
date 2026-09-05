import { NextResponse } from "next/server";

const BIO_PLATFORMS = new Set(["tiktok", "instagram", "youtube", "facebook"]);

export function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> },
) {
  return params.then(({ platform }) => {
    if (!BIO_PLATFORMS.has(platform))
      return NextResponse.redirect(new URL("/?link=unavailable", request.url), 302);

    const url = new URL("/", request.url);
    url.searchParams.set("s", platform);
    url.searchParams.set("a", `${platform}-bio`);
    url.searchParams.set("c", "bio");
    url.searchParams.set("cl", "profile");
    return NextResponse.redirect(url, 302);
  });
}
