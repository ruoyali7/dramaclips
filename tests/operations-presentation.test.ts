import {describe,it,expect} from "vitest";
import {hasUncertainOutcome,publishedPlatformCount,recoveryGuidance,platformError,platformPostUrl} from "@/lib/publish-task-presentation";
import {nextPublishWorkerWindow} from "@/lib/publish-worker-window";
describe("operational task presentation",()=>{
  const task={status:"failed",platforms:[{source:"tiktok"},{source:"instagram"}],yixiaoerResults:{tiktok:{state:"published"},instagram:{state:"outcome_unknown"}}};
  it("distinguishes partial delivery from uncertain outcomes",()=>{expect(publishedPlatformCount(task)).toBe(1);expect(hasUncertainOutcome(task)).toBe(true);expect(recoveryGuidance(task)).toContain("before retrying");});
  it("prefers the provider error and only permits web post links",()=>{expect(platformError({error:"Failed",reconciliation:{tasks:[{errorMessage:"Invalid parameter"}]}})).toBe("Invalid parameter");expect(platformPostUrl({platformPostUrl:"javascript:alert(1)"})).toBeUndefined();expect(platformPostUrl({reconciliation:{tasks:[{openUrl:"https://example.com/post"}]}})).toBe("https://example.com/post");});
  it("starts at the requested time because the worker polls continuously",()=>{expect(nextPublishWorkerWindow("2026-09-12T06:00:00Z")).toBe("2026-09-12T06:00:00.000Z");expect(nextPublishWorkerWindow("2026-09-12T19:10:00Z")).toBe("2026-09-12T19:10:00.000Z");expect(nextPublishWorkerWindow("invalid")).toBeNull();});
});
