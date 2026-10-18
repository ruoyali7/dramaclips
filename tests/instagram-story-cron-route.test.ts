import {beforeEach,describe,expect,it,vi} from "vitest";

const {createReconnectInstagramStoryPlan}=vi.hoisted(()=>({createReconnectInstagramStoryPlan:vi.fn()}));
vi.mock("@/lib/admin/instagram-story-service",()=>({createReconnectInstagramStoryPlan}));

import {NextRequest} from "next/server";
import {GET} from "@/app/api/cron/instagram-stories/route";

describe("Instagram Story cron",()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    process.env.CRON_SECRET="cron-secret";
  });

  it("rejects requests without the Vercel cron secret",async()=>{
    const response=await GET(new NextRequest("https://dramaclips.vercel.app/api/cron/instagram-stories"));
    expect(response.status).toBe(401);
    expect(createReconnectInstagramStoryPlan).not.toHaveBeenCalled();
  });

  it("creates the daily plan without triggering Railway",async()=>{
    createReconnectInstagramStoryPlan.mockResolvedValue([{id:"story-1"},{id:"story-2"}]);
    const response=await GET(new NextRequest("https://dramaclips.vercel.app/api/cron/instagram-stories",{
      headers:{authorization:"Bearer cron-secret"},
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({count:2});
    expect(createReconnectInstagramStoryPlan).toHaveBeenCalledOnce();
  });
});
