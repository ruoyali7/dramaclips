import { NextResponse } from "next/server";
import { getDramaBySlug } from "@/lib/catalog";
import { getLatestPublishPackage } from "@/lib/admin/publish-repository";

function cell(value: string | boolean) {
  const text = typeof value === "boolean" ? (value ? "TRUE" : "FALSE") : value;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET() {
  try {
    const item = await getLatestPublishPackage();
    if (!item) return NextResponse.json({ message: "Create a publish package first" }, { status: 404 });
    const drama = await getDramaBySlug(item.dramaSlug);
    const title = drama?.title || item.dramaSlug;
    const date = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const headers = [
      "Text", "Date", "Time", "Draft", "Facebook", "Twitter/X", "LinkedIn", "GBP", "Instagram", "Pinterest", "TikTok", "YouTube", "Threads", "Bluesky",
      "Picture Url 1", "Picture Url 2", "Picture Url 3", "Picture Url 4", "Picture Url 5", "Picture Url 6", "Picture Url 7", "Picture Url 8", "Picture Url 9", "Picture Url 10",
      "Alt text picture 1", "Alt text picture 2", "Alt text picture 3", "Alt text picture 4", "Alt text picture 5", "Alt text picture 6", "Alt text picture 7", "Alt text picture 8", "Alt text picture 9", "Alt text picture 10",
      "Document title", "Shortener", "Video Thumbnail Url", "Video Cover Frame", "Twitter/X Can reply", "Twitter/X Type", "Twitter/X Poll Duration minutes", "Twitter/X Poll Option 1", "Twitter/X Poll Option 2", "Twitter/X Poll Option 3", "Twitter/X Poll Option 4",
      "Pinterest Board", "Pinterest Pin Title", "Pinterest Pin Link", "Pinterest Pin New Format", "Instagram Post Type", "Instagram Show Reel On Feed", "YouTube Video Title", "YouTube Video Type", "YouTube Video Privacy", "YouTube video for kids", "YouTube Video Category", "YouTube Video Tags", "YouTube Playlist",
      "GBP Post Type", "Facebook Post Type", "Facebook Title", "First Comment Text", "TikTok Title", "TikTok disable comments", "TikTok disable duet", "TikTok disable stitch", "TikTok Post Privacy (personal accounts only)", "TikTok Branded Content (personal accounts only)", "TikTok Your Brand (personal accounts only)", "TikTok Auto Add Music (personal accounts only)", "TikTok Photo Cover Index", "TikTok musicId", "TikTok music title", "TikTok music author", "TikTok music previewUrl", "TikTok music thumbnailUrl", "TikTok music soundVolume", "TikTok music originalVolume", "TikTok music startMillis", "TikTok music endMillis",
      "LinkedIn Type", "LinkedIn Poll Question", "LinkedIn Poll Option 1", "LinkedIn Poll Option 2", "LinkedIn Poll Option 3", "LinkedIn Poll Option 4", "LinkedIn Poll Duration", "LinkedIn Show link preview", "LinkedIn Images as Carousel", "Threads Reply Control", "Threads Is Spoiler", "Threads Post Type", "Brand name (Optional)",
    ];
    const rows = item.platforms.map((pack) => {
      const values: Record<string, string | boolean> = {
        Text: pack.caption,
        Date: date ? date.toISOString().slice(0, 10) : "",
        Time: date ? date.toISOString().slice(11, 19) : "",
        Draft: !date,
        Facebook: pack.source === "facebook", "Twitter/X": pack.source === "x", LinkedIn: false, GBP: false,
        Instagram: pack.source === "instagram", Pinterest: false, TikTok: pack.source === "tiktok", YouTube: pack.source === "youtube", Threads: false, Bluesky: false,
        "Picture Url 1": item.videoUrl, Shortener: false,
        "Instagram Post Type": "REEL", "Instagram Show Reel On Feed": true,
        "YouTube Video Title": `${title} · EP ${item.episodeNumber}`.slice(0, 100), "YouTube Video Type": "SHORT", "YouTube Video Privacy": "PUBLIC", "YouTube video for kids": false,
        "Facebook Post Type": "REEL", "Facebook Title": `${title} · EP ${item.episodeNumber}`,
        "TikTok disable comments": false, "TikTok disable duet": false, "TikTok disable stitch": false,
        "TikTok Post Privacy (personal accounts only)": "PUBLIC_TO_EVERYONE", "Brand name (Optional)": "",
      };
      return headers.map((header) => cell(values[header] ?? "")).join(",");
    });
    const csv = `\uFEFF${headers.map(cell).join(",")}\n${rows.join("\n")}`;
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="metricool-${item.dramaSlug}-ep-${item.episodeNumber}.csv"` } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not export Metricool CSV" }, { status: 503 });
  }
}
