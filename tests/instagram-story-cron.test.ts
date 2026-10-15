import {afterEach,describe,expect,it,vi} from "vitest";

const triggerRailwayWorker=vi.hoisted(()=>vi.fn());
vi.mock("@/lib/admin/railway-worker-trigger",()=>({triggerRailwayWorker}));

import {GET} from "@/app/api/cron/instagram-stories/route";

describe("Instagram Story cron",()=>{
  afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});

  it("rejects requests without the Vercel cron secret",async()=>{
    vi.stubEnv("CRON_SECRET","cron-secret");
    const response=await GET(new Request("https://example.com/api/cron/instagram-stories") as never);
    expect(response.status).toBe(401);
    expect(triggerRailwayWorker).not.toHaveBeenCalled();
  });

  it("starts only the dedicated Story worker",async()=>{
    vi.stubEnv("CRON_SECRET","cron-secret");
    triggerRailwayWorker.mockResolvedValue({status:"restarted",deploymentId:"deployment-1"});
    const response=await GET(new Request("https://example.com/api/cron/instagram-stories",{headers:{authorization:"Bearer cron-secret"}}) as never);
    expect(response.status).toBe(202);
    expect(triggerRailwayWorker).toHaveBeenCalledWith("story");
  });
});
