import {beforeEach,describe,expect,it,vi} from "vitest";

const {enqueue,getPackage}=vi.hoisted(()=>({enqueue:vi.fn(),getPackage:vi.fn()}));
vi.mock("@/lib/admin/publish-repository",()=>({enqueueYixiaoerPackage:enqueue,getPublishPackage:getPackage,requestCancelYixiaoerPackage:vi.fn(),rescheduleYixiaoerPackage:vi.fn()}));
vi.mock("@/lib/admin/yixiaoer",()=>({yixiaoerPlatforms:["tiktok","instagram","facebook","youtube"]}));
import {POST} from "@/app/api/admin/publish-packages/[id]/yixiaoer/route";

const context={params:Promise.resolve({id:"package-1"})};
const failedUpload={id:"package-1",status:"failed",yixiaoerAction:null,platforms:[{source:"tiktok"}],yixiaoerResults:{_intent:{deliveryMode:"now"},_operation:{stage:"uploading_to_yixiaoer"}}};
function request(body:unknown){return new Request("http://localhost/api",{method:"POST",body:JSON.stringify(body)});}

describe("publish retry route",()=>{
  beforeEach(()=>{enqueue.mockReset();getPackage.mockReset();});
  it("retries only the requested platform and blocks unknown outcomes",async()=>{
    const item={id:"package-1",status:"failed",platforms:[{source:"instagram"},{source:"facebook"}],yixiaoerResults:{instagram:{state:"failed"},facebook:{state:"failed"}}};
    getPackage.mockResolvedValue(item);enqueue.mockResolvedValue({id:"package-1",status:"publishing"});
    const accounts={instagram:"ig-1",facebook:"fb-1"};
    const response=await POST(request({action:"retry",platform:"instagram",deliveryMode:"now",accounts}) as never,context);
    expect(response.status).toBe(202);expect(enqueue.mock.calls[0][1].control).toEqual({retryPlatforms:["instagram"]});
    enqueue.mockClear();getPackage.mockResolvedValue({...item,yixiaoerResults:{instagram:{state:"outcome_unknown"}}});
    expect((await POST(request({action:"retry",platform:"instagram",deliveryMode:"now",accounts}) as never,context)).status).toBe(409);expect(enqueue).not.toHaveBeenCalled();
  });

  it("rejects a past scheduled upload retry",async()=>{
    getPackage.mockResolvedValue(failedUpload);
    const response=await POST(request({action:"retry-upload",deliveryMode:"scheduled",scheduledAt:"2020-01-01T00:00:00.000Z",accounts:{tiktok:"account-1"}}) as never,context);
    expect(response.status).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("reuses the package for a future scheduled upload retry",async()=>{
    const scheduledAt="2099-01-01T20:00:00.000Z";
    getPackage.mockResolvedValue(failedUpload);
    enqueue.mockResolvedValue({id:"package-1",status:"scheduled"});
    const response=await POST(request({action:"retry-upload",deliveryMode:"scheduled",scheduledAt,accounts:{tiktok:"account-1"}}) as never,context);
    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith("package-1",{action:"publish",accounts:{tiktok:"account-1"},control:undefined,scheduledAt,clearSchedule:false});
  });

  it("clears an old schedule for an immediate retry",async()=>{
    getPackage.mockResolvedValue(failedUpload);
    enqueue.mockResolvedValue({id:"package-1",status:"publishing"});
    await POST(request({action:"retry-upload",deliveryMode:"now",accounts:{tiktok:"account-1"}}) as never,context);
    expect(enqueue).toHaveBeenCalledWith("package-1",{action:"publish",accounts:{tiktok:"account-1"},control:undefined,scheduledAt:undefined,clearSchedule:true});
  });

  it("continues only platforms without a confirmed published result",async()=>{
    getPackage.mockResolvedValue({
      id:"package-1",status:"failed",yixiaoerAction:null,
      platforms:[{source:"tiktok"},{source:"instagram"},{source:"facebook"},{source:"youtube"}],
      yixiaoerResults:{tiktok:{state:"published"},instagram:{state:"published"},facebook:{state:"failed"}},
    });
    const accounts={tiktok:"tiktok-1",instagram:"instagram-1",facebook:"facebook-1",youtube:"youtube-1"};
    enqueue.mockResolvedValue({id:"package-1",status:"publishing"});
    const response=await POST(request({action:"retry",deliveryMode:"now",accounts}) as never,context);
    expect(response.status).toBe(202);
    expect(enqueue).toHaveBeenCalledWith("package-1",{
      action:"publish",accounts,control:{retryPlatforms:["facebook","youtube"]},scheduledAt:undefined,clearSchedule:true,
    });
  });
});
