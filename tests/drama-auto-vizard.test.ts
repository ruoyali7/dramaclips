import {beforeEach,describe,expect,it,vi} from "vitest";

const {save,publish,enqueue}=vi.hoisted(()=>({save:vi.fn(),publish:vi.fn(),enqueue:vi.fn()}));
vi.mock("@/lib/admin/repository",()=>({saveDramaDraft:save,publishDramaDraft:publish}));
vi.mock("@/lib/admin/vizard-repository",()=>({enqueueVizardSubmissions:enqueue}));
import {POST} from "@/app/api/admin/dramas/route";

const body={title:"Test Drama",slug:"test-drama",publicCode:"1234",promoCode:"1234",language:"en",tags:[],description:"A sufficiently long drama description.",coverUrl:"/cover.jpg",cpsUrl:"https://reelslink.com/cps/test",episodes:[{episodeNumber:1,videoUrl:"https://cdn.example.com/1.mp4"},{episodeNumber:2,videoUrl:"https://cdn.example.com/2.mp4"}]};
const request=()=>new Request("http://localhost/api/admin/dramas",{method:"POST",body:JSON.stringify(body)});

describe("Add Drama automatic Vizard production",()=>{
  beforeEach(()=>{save.mockReset();publish.mockReset();enqueue.mockReset();save.mockResolvedValue({id:"drama-1",slug:"test-drama",title:"Test Drama",episodeCount:2});publish.mockResolvedValue({});});

  it("queues every episode after publishing the drama",async()=>{
    enqueue.mockResolvedValue([{id:"one"},{id:"two"}]);
    const response=await POST(request() as never);const json=await response.json();
    expect(response.status).toBe(201);expect(enqueue).toHaveBeenCalledOnce();expect(enqueue.mock.calls[0][0]).toHaveLength(2);expect(json.vizard).toEqual({status:"queued",requested:2,accepted:2});
  });

  it("keeps the published drama successful when automation queueing fails",async()=>{
    enqueue.mockRejectedValue(new Error("queue unavailable"));
    const response=await POST(request() as never);const json=await response.json();
    expect(response.status).toBe(201);expect(json.draft.status).toBe("published");expect(json.vizard.status).toBe("failed");
  });
});
