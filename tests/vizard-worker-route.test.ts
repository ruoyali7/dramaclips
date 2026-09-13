import {beforeEach,describe,expect,it,vi} from "vitest";

const {trigger}=vi.hoisted(()=>({trigger:vi.fn()}));
vi.mock("@/lib/admin/railway-worker-trigger",()=>({triggerRailwayWorker:trigger}));
import {POST} from "@/app/api/admin/vizard/worker/route";

describe("Vizard worker manual trigger",()=>{
  beforeEach(()=>trigger.mockReset());

  it("starts the Vizard worker once",async()=>{
    trigger.mockResolvedValue({status:"restarted",deploymentId:"deployment-1"});
    const response=await POST();
    expect(response.status).toBe(202);
    expect(trigger).toHaveBeenCalledWith("vizard");
  });

  it("reports missing trigger configuration",async()=>{
    trigger.mockResolvedValue({status:"disabled"});
    const response=await POST();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({message:"Vizard worker trigger is not configured"});
  });
});
