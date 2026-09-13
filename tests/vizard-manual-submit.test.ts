import {beforeEach,describe,expect,it,vi} from "vitest";
const {enqueue,trigger}=vi.hoisted(()=>({enqueue:vi.fn(),trigger:vi.fn()}));
vi.mock("@/lib/admin/vizard-repository",()=>({enqueueVizardSubmissions:enqueue}));
vi.mock("@/lib/admin/railway-worker-trigger",()=>({triggerRailwayWorker:trigger}));
import {POST} from "@/app/api/admin/vizard/submit-batch/route";
const request=()=>new Request("http://localhost/api/admin/vizard/submit-batch",{method:"POST",body:JSON.stringify({jobs:[{dramaId:"drama",dramaSlug:"drama",episodeNumber:1,projectName:"Drama EP 1",videoUrl:"https://example.com/video.mp4",settings:{}}]})});
describe("manual Vizard submission",()=>{
  beforeEach(()=>{enqueue.mockReset();trigger.mockReset();});
  it("queues before starting the worker and preserves queued work if trigger is disabled",async()=>{
    enqueue.mockResolvedValue([{id:"job"}]);trigger.mockResolvedValue({status:"disabled"});
    const response=await POST(request() as never);
    expect(response.status).toBe(202);
    expect(enqueue.mock.invocationCallOrder[0]).toBeLessThan(trigger.mock.invocationCallOrder[0]);
    expect(trigger).toHaveBeenCalledWith("vizard");
    expect(await response.json()).toMatchObject({jobs:[{id:"job"}],workerTrigger:{status:"disabled"}});
  });
  it("does not start the worker if queueing fails",async()=>{
    enqueue.mockRejectedValue(new Error("queue unavailable"));
    expect((await POST(request() as never)).status).toBe(503);
    expect(trigger).not.toHaveBeenCalled();
  });
});
