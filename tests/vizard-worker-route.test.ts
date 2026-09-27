import {beforeEach,describe,expect,it,vi} from "vitest";

const {trigger,clear}=vi.hoisted(()=>({trigger:vi.fn(),clear:vi.fn()}));
vi.mock("@/lib/admin/railway-worker-trigger",()=>({triggerRailwayWorker:trigger}));
vi.mock("@/lib/admin/vizard-repository",()=>({clearVizardSubmissionQueue:clear,listVizardSubmissionJobs:vi.fn(),listVizardProjects:vi.fn()}));
import {DELETE,POST} from "@/app/api/admin/vizard/worker/route";

describe("Vizard worker manual trigger",()=>{
  beforeEach(()=>{trigger.mockReset();clear.mockReset();});

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

  it("clears only the waiting Vizard queue through the repository",async()=>{
    clear.mockResolvedValue(4);
    const response=await DELETE();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({cleared:4});
  });
});
