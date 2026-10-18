import {afterEach,describe,expect,it,vi} from "vitest";

const createReconnectInstagramStoryPlan=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/admin/instagram-story-service",()=>({createReconnectInstagramStoryPlan}));

import {GET} from "@/app/api/cron/instagram-stories/route";

describe("Instagram Story cron",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});

  it("rejects requests without the Vercel cron secret",async()=>{
    vi.stubEnv("CRON_SECRET","cron-secret");
    const response=await GET(new Request("https://example.com/api/cron/instagram-stories") as never);
    expect(response.status).toBe(401);
    expect(createReconnectInstagramStoryPlan).not.toHaveBeenCalled();
  });

  it("creates the daily reconnect plan",async()=>{
    vi.stubEnv("CRON_SECRET","cron-secret");
    createReconnectInstagramStoryPlan.mockResolvedValue([{id:"job-1"}]);
    const response=await GET(new Request("https://example.com/api/cron/instagram-stories",{headers:{authorization:"Bearer cron-secret"}}) as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({jobs:[{id:"job-1"}],count:1});
    expect(createReconnectInstagramStoryPlan).toHaveBeenCalledOnce();
  });
});
