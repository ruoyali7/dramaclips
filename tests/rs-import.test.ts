import { describe, expect, it } from "vitest";
import { importFromRs, normalizeRsPayload, parseRsText, parseRsUrl } from "@/lib/admin/rs-import";
import { readRsTransfer, RS_TRANSFER_PREFIX, rsBookmarklet } from "@/lib/admin/rs-transfer";

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

  it("skips explanatory text before the real RS promotion code", () => {
    const result = parseRsText(`RS Boost\n资源广场\n我的推广\n我的收益\nzh\navatar\ncover\nThe Cold CEO Who Spoiled Me Online\n英语\n扮猪吃虎\n上线时间: 2026-08-11\n共30章，前6章节免费\n收起\nI lied about my age and ghosted my clingy online boyfriend half a year ago. Staying at my best friend’s house for break, I froze—her cold, CEO older brother Rhys was exactly the man I dumped online. He recognized me just by my voice and kept testing me nonstop.\nApp推广链接\n用户点击此链接跳转到应用市场下载安装App后打开App跳转到首页\nhttps://reelslink.com/cps/g8BYMM\n资源推广链接\n用户点击此链接跳转到应用市场下载安装App后打开App跳转到本资源的阅读界面\nhttps://reelslink.com/cps/qzpbZl\n资源推广口令\n用户在App内搜索该口令可展示本资源及绑定归因关系\n3470108`);
    expect(result).toMatchObject({ title: "The Cold CEO Who Spoiled Me Online", slug: "the-cold-ceo-who-spoiled-me-online", publicCode: "3470108", promoCode: "3470108", tags: ["扮猪吃虎"], cpsUrl: "https://reelslink.com/cps/qzpbZl", chapterCount: 30, freeChapterCount: 6 });
  });

  it("imports copied text without requiring a resource link", async () => {
    await expect(importFromRs(undefined, "cover\nText Only Drama\n英语\n资源推广口令\n1234567")).resolves.toMatchObject({ title: "Text Only Drama", promoCode: "1234567" });
  });

  it("parses an English page captured by the browser helper", () => {
    const result = parseRsText(`Content Hub\nMy Referral\nMy Earnings\nEN\nThe Cold CEO Who Spoiled Me Online\nEnglish\nPlaying Dumb\nRelease Date: 2026-08-11\n30 Episodes, First 6 Free\nI lied about my age and ghosted my clingy online boyfriend half a year ago. Staying at my best friend’s house for break, I froze—her cold, CEO older brother Rhys was exactly the man I dumped online. He recognized me just by my voice and kept testing me nonstop.\nApp Promotion Link\nCopy\nContent Promotion Link\nCopy\nContent Referral Code\nCopy\nDRAMACLIPS_CAPTURED_VALUES\nhttps://reelslink.com/cps/g8BYMM\nhttps://reelslink.com/cps/qzpbZl\n3470108\nDRAMACLIPS_IMAGE|cover|https://cdn.example.com/cold-ceo.jpg|360|480`);
    expect(result).toMatchObject({ title: "The Cold CEO Who Spoiled Me Online", slug: "the-cold-ceo-who-spoiled-me-online", promoCode: "3470108", cpsUrl: "https://reelslink.com/cps/qzpbZl", coverUrl: "https://cdn.example.com/cold-ceo.jpg", chapterCount: 30, freeChapterCount: 6, tags: ["Playing Dumb"] });
  });
});

describe("RS browser transfer", () => {
  it("accepts transfers only from RS Boost", () => {
    const valid = RS_TRANSFER_PREFIX + JSON.stringify({ version: 1, source: "https://cps.reelshort.com/resource-square/detail/abc?app=reelshort", text: "cover\nA Drama" });
    expect(readRsTransfer(valid)).toMatchObject({ text: "cover\nA Drama" });
    const invalid = RS_TRANSFER_PREFIX + JSON.stringify({ version: 1, source: "https://example.com/fake", text: "content" });
    expect(readRsTransfer(invalid)).toBeNull();
  });

  it("keeps the authorized episode payload", () => {
    const chapters = Array.from({ length: 12 }, (_, index) => ({
      chapter_id: `chapter-${index + 1}`,
      play_url: `https://series.oss-accelerate.aliyuncs.com/${index + 1}.mp4`,
    }));
    const value = RS_TRANSFER_PREFIX + JSON.stringify({
      version: 2,
      source: "https://cps.reelshort.com/resource-square/detail/6a754311338f32d80c0fc293?app=reelshort&book_type=0",
      text: "cover\nMy Fireplace Ships to Dragon Realm",
      book: { book_id: "6a754311338f32d80c0fc293", chapter_count: 40, pay_start: 9 },
      chapters,
    });

    const transfer = readRsTransfer(value);
    expect(transfer?.version).toBe(2);
    expect(transfer?.chapters).toHaveLength(12);
    expect(transfer?.chapters?.[0]).toMatchObject({ chapter_id: "chapter-1" });
  });

  it("builds a bookmarklet without embedding credentials", () => {
    const result = rsBookmarklet("https://dramaclips.vercel.app/admin/dramas/new");
    expect(result).toMatch(/^javascript:/);
    expect(result).toContain("document.body.innerText");
    expect(result).toContain("/api/v1/book/book-detail");
    expect(result).toContain("credentials:'include'");
    expect(result).toContain("play_url");
    expect(result).not.toMatch(/cookie|token|localStorage/i);
  });
});
