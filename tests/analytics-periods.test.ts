import {describe,it,expect} from "vitest";
import {analyticsPeriods} from "@/lib/analytics-periods";
describe("analytics comparison periods",()=>{
 it("uses equal non-overlapping selected periods",()=>{const p=analyticsPeriods(7,new Date("2026-09-13T19:00:00Z"));expect(p.range.to.getTime()-p.range.from.getTime()).toBe(p.previous.to.getTime()-p.previous.from.getTime());expect(p.previous.to).toEqual(p.range.from);});
 it("compares today only with the same elapsed time yesterday",()=>{const p=analyticsPeriods(30,new Date("2026-09-13T19:00:00Z"));expect(p.today.to.getTime()-p.today.from.getTime()).toBe(p.yesterday.to.getTime()-p.yesterday.from.getTime());});
 it("contains exactly seven calendar dates in the current range",()=>{const p=analyticsPeriods(7,new Date("2026-09-13T19:00:00Z"));expect(p.range.from.toISOString()).toBe("2026-09-07T07:00:00.000Z");});
});
