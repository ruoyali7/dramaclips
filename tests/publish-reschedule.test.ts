import {beforeEach,describe,expect,it,vi} from "vitest";

const {rescheduleYixiaoerPackage}=vi.hoisted(()=>({rescheduleYixiaoerPackage:vi.fn()}));

vi.mock("@/lib/admin/publish-repository",()=>({
  enqueueYixiaoerPackage:vi.fn(),
  getPublishPackage:vi.fn(),
  requestCancelYixiaoerPackage:vi.fn(),
  rescheduleYixiaoerPackage,
}));
vi.mock("@/lib/admin/yixiaoer",()=>({yixiaoerPlatforms:["tiktok","instagram","youtube","facebook"]}));

import {POST} from "@/app/api/admin/publish-packages/[id]/yixiaoer/route";

const context={params:Promise.resolve({id:"package-1"})};

describe("publish reschedule action",()=>{
  beforeEach(()=>rescheduleYixiaoerPackage.mockReset());

  it("requires a new scheduled time",async()=>{
    const response=await POST(new Request("http://localhost/api",{method:"POST",body:JSON.stringify({action:"reschedule"})}) as never,context);
    expect(response.status).toBe(400);
    expect(rescheduleYixiaoerPackage).not.toHaveBeenCalled();
  });

  it("updates the existing scheduled package",async()=>{
    const scheduledAt="2027-01-01T20:30:00.000Z";
    rescheduleYixiaoerPackage.mockResolvedValue({id:"package-1",status:"scheduled",scheduledAt});
    const response=await POST(new Request("http://localhost/api",{method:"POST",body:JSON.stringify({action:"reschedule",scheduledAt})}) as never,context);
    expect(response.status).toBe(200);
    expect(rescheduleYixiaoerPackage).toHaveBeenCalledWith("package-1",scheduledAt);
    await expect(response.json()).resolves.toEqual({package:{id:"package-1",status:"scheduled",scheduledAt}});
  });
});
