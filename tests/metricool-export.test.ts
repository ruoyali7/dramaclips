import { beforeEach, describe, expect, it, vi } from "vitest";

const { getLatestPublishPackage, getDramaBySlug } = vi.hoisted(() => ({
  getLatestPublishPackage: vi.fn(),
  getDramaBySlug: vi.fn(),
}));

vi.mock("@/lib/admin/publish-repository", () => ({ getLatestPublishPackage }));
vi.mock("@/lib/catalog", () => ({ getDramaBySlug }));

import { GET } from "@/app/api/admin/publish-packages/latest/csv/route";

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if (char === "\n" && !quoted) { row.push(field); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  row.push(field); rows.push(row);
  return rows;
}

describe("Metricool CSV export", () => {
  beforeEach(() => {
    getDramaBySlug.mockResolvedValue({ title: "Example Drama" });
    getLatestPublishPackage.mockResolvedValue({
      dramaSlug: "example-drama", episodeNumber: 1, videoUrl: "https://cdn.example/video.mp4",
      scheduledAt: "2026-08-12T22:00:00.000Z",
      platforms: ["tiktok", "instagram", "facebook", "youtube"].map((source) => ({ source, caption: `${source} caption` })),
    });
  });

  it("matches the platform-specific field layout of Metricool's template", async () => {
    const response = await GET();
    const text = await response.text();
    const [headers, ...records] = parseCsv(text);
    const rows = records.map((record) => Object.fromEntries(headers.map((header, i) => [header, record[i]])));

    expect(text.charCodeAt(0)).not.toBe(0xfeff);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
    expect(text.startsWith("Text,Date,Time,Draft,")).toBe(true);
    expect(rows.every((row) => row.Draft === "false")).toBe(true);
    expect(rows.every((row) => row.Date === "2026-08-12" && row.Time === "15:00:00")).toBe(true);
    expect(rows[0]["TikTok Post Privacy"]).toBe("PUBLIC_TO_EVERYONE");
    expect(rows[0]["Instagram Post Type"]).toBe("");
    expect(rows[0]["Youtube Video Title"]).toBe("");
    expect(rows[0]["Facebook Post Type"]).toBe("");
    expect(rows[1]["Instagram Post Type"]).toBe("REEL");
    expect(rows[2]["Facebook Post Type"]).toBe("REEL");
    expect(rows[3]["Youtube Video Type"]).toBe("SHORT");
    expect(rows[3]["TikTok Post Privacy"]).toBe("");
    expect(headers).toHaveLength(95);
    expect(records.every((record) => record.length === 95)).toBe(true);
  });
});
