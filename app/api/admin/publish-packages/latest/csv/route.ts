import { NextResponse } from "next/server";
import { getDramaBySlug } from "@/lib/catalog";
import { getLatestPublishPackage } from "@/lib/admin/publish-repository";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const blankColumns = new Set([
  "Alt text picture 1", "Pinterest Board", "Pinterest Pin Title", "Pinterest Pin Link", "Pinterest Pin New Format",
  "Youtube AI generated content", "TikTok Branded Content", "TikTok Your Brand", "TikTok Auto Add Music",
  "TikTok musicId", "TikTok music title", "TikTok music author", "TikTok music previewUrl", "TikTok music thumbnailUrl",
  "TikTok music soundVolume", "TikTok music originalVolume", "TikTok music startMillis", "TikTok music endMillis",
  "LinkedIn Show link preview", "LinkedIn Images as Carousel",
]);

function cell(header: string, value: string | boolean | number | undefined) {
  if (value === undefined) return blankColumns.has(header) ? "" : '""';
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  // Metricool's own template represents this enum as an unquoted token.
  if (header === "TikTok Post Privacy") return value;
  return `"${value.replace(/"/g, '""')}"`;
}
function pacificParts(date:Date){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(date);const get=(type:string)=>parts.find(part=>part.type===type)?.value||"";return{date:`${get("year")}-${get("month")}-${get("day")}`,time:`${get("hour")}:${get("minute")}:00`}}

export async function GET() {
  try {
    const item = await getLatestPublishPackage();
    if (!item) return NextResponse.json({ message: "Create a publish package first" }, { status: 404 });
    const drama = await getDramaBySlug(item.dramaSlug);
    const title = drama?.title || item.dramaSlug;
    const date = item.scheduledAt ? new Date(item.scheduledAt) : null;
    const local = date ? pacificParts(date) : null;
    const headers = [
      "Text", "Date", "Time", "Draft", "Facebook", "Twitter/X", "LinkedIn", "GBP", "Instagram", "Pinterest", "TikTok", "Youtube", "Threads", "Bluesky",
      "Picture Url 1", "Picture Url 2", "Picture Url 3", "Picture Url 4", "Picture Url 5", "Picture Url 6", "Picture Url 7", "Picture Url 8", "Picture Url 9", "Picture Url 10",
      "Alt text picture 1", "Alt text picture 2", "Alt text picture 3", "Alt text picture 4", "Alt text picture 5", "Alt text picture 6", "Alt text picture 7", "Alt text picture 8", "Alt text picture 9", "Alt text picture 10",
      "Document title", "Shortener", "Video Thumbnail Url", "Video Cover Frame", "Twitter/X Can reply", "Twitter/X Type", "Twitter/X Poll Duration minutes", "Twitter/X Poll Option 1", "Twitter/X Poll Option 2", "Twitter/X Poll Option 3", "Twitter/X Poll Option 4",
      "Pinterest Board", "Pinterest Pin Title", "Pinterest Pin Link", "Pinterest Pin New Format", "Instagram Post Type", "Instagram Show Reel On Feed", "Instagram Trial Reel Share Automatically", "Youtube Video Title", "Youtube Video Type", "Youtube Video Privacy", "Youtube video for kids", "Youtube AI generated content", "Youtube Video Category", "Youtube Video Tags", "Youtube playlist",
      "GBP Post Type", "Facebook Post Type", "Facebook Title", "First Comment Text", "TikTok Title", "TikTok disable comments", "TikTok disable duet", "TikTok disable stitch", "TikTok Post Privacy", "TikTok Branded Content", "TikTok Your Brand", "TikTok Auto Add Music", "TikTok Photo Cover Index", "TikTok musicId", "TikTok music title", "TikTok music author", "TikTok music previewUrl", "TikTok music thumbnailUrl", "TikTok music soundVolume", "TikTok music originalVolume", "TikTok music startMillis", "TikTok music endMillis", "TikTok is AI generated content",
      "LinkedIn Type", "LinkedIn Poll Question", "LinkedIn Poll Option 1", "LinkedIn Poll Option 2", "LinkedIn Poll Option 3", "LinkedIn Poll Option 4", "LinkedIn Poll Duration", "LinkedIn Show link preview", "LinkedIn Images as Carousel", "Threads Reply Control", "Threads Is Spoiler", "Threads Post Type",
    ];
    const rows = item.platforms.map((pack) => {
      const values: Record<string, string | boolean | number> = {
        Text: pack.caption,
        Date: local?.date || "",
        Time: local?.time || "",
        Draft: !date,
        Facebook: pack.source === "facebook", "Twitter/X": pack.source === "x", LinkedIn: false, GBP: false,
        Instagram: pack.source === "instagram", Pinterest: false, TikTok: pack.source === "tiktok", Youtube: pack.source === "youtube", Threads: false, Bluesky: false,
        "Picture Url 1": item.videoUrl, Shortener: false,
        ...(pack.source === "instagram" ? { "Instagram Post Type": "REEL", "Instagram Show Reel On Feed": true } : {}),
        ...(pack.source === "youtube" ? { "Youtube Video Title": `${title} · EP ${item.episodeNumber}`.slice(0, 100), "Youtube Video Type": "SHORT", "Youtube Video Privacy": "PUBLIC", "Youtube video for kids": false } : {}),
        ...(pack.source === "facebook" ? { "Facebook Post Type": "REEL", "Facebook Title": `${title} · EP ${item.episodeNumber}` } : {}),
        "TikTok disable comments": false, "TikTok disable duet": false, "TikTok disable stitch": false,
        ...(pack.source === "tiktok" ? { "TikTok Post Privacy": "PUBLIC_TO_EVERYONE", "TikTok Photo Cover Index": 0 } : {}), "TikTok is AI generated content": false,
        "Twitter/X Type": "POST", "LinkedIn Type": "POST", "Threads Is Spoiler": false,
      };
      return headers.map((header) => cell(header, values[header])).join(",");
    });
    const csv = `${headers.join(",")}\n${rows.join("\n")}`;
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="metricool-${item.dramaSlug}-ep-${item.episodeNumber}.csv"`, "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate", Pragma: "no-cache", Expires: "0" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Could not export Metricool CSV" }, { status: 503 });
  }
}
