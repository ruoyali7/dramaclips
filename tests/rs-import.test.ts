import { describe, expect, it } from "vitest";
import { normalizeRsPayload, parseRsText, parseRsUrl } from "@/lib/admin/rs-import";

describe("RS Boost import", () => {
  it("accepts only resource detail links", () => {
    expect(parseRsUrl("https://cps.reelshort.com/resource-square/detail/6a6c022eedfbef3f380fbfbf?app=reelshort&book_type=0")).toEqual({ resourceId: "6a6c022eedfbef3f380fbfbf", app: "reelshort", bookType: 0 });
    expect(() => parseRsUrl("https://example.com/resource-square/detail/1234")).toThrow();
  });

  it("normalizes likely API field variants", () => {
    expect(normalizeRsPayload({ data: { book_name: "Traded My Wolves for a Snake", book_desc: "A sufficiently long drama description.", cover_url: "https://media.example/cover.jpg", promotion_code: "3469908", resource_promotion_link: "https://reelslink.com/cps/example", total_chapter_num: 24, tags: ["Revenge", "Fantasy"] } })).toMatchObject({ title: "Traded My Wolves for a Snake", slug: "traded-my-wolves-for-a-snake", publicCode: "3469908", chapterCount: 24, tags: ["Revenge", "Fantasy"] });
  });

  it("parses copied page text as an authenticated fallback", () => {
    const result = parseRsText(`RS Boost\ncover\nTraded My Wolves for a Snake\n英语\n共24章，前5章节免费\nCora took in three wounded wolves and raised them. The moment her sister appeared, everything changed and she chose a different path for her future.\n资源推广链接\nhttps://reelslink.com/cps/bQTjdV\n资源推广口令\n3469908`);
    expect(result).toMatchObject({ title: "Traded My Wolves for a Snake", promoCode: "3469908", publicCode: "3469908", cpsUrl: "https://reelslink.com/cps/bQTjdV", chapterCount: 24, language: "en" });
  });
});
