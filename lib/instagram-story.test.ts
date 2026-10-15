import {describe,expect,it} from "vitest";
import {reelShortUrl} from "./instagram-story";

describe("reelShortUrl",()=>{
 it("extracts the direct ReelShort URL from a Poster Publisher caption",()=>{
  const caption="Watch now: https://reelslink.com/cps/6FvHTQ\nContent Code: 5159963";
  expect(reelShortUrl(caption)).toBe("https://reelslink.com/cps/6FvHTQ");
 });
 it("does not accept a DramaClips or lookalike link",()=>{
  expect(reelShortUrl("https://dramaclips.com/x/test")).toBeUndefined();
  expect(reelShortUrl("https://reelslink.com.evil.example/cps/test")).toBeUndefined();
 });
});
