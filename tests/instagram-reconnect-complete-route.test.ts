import {beforeEach,describe,expect,it,vi} from "vitest";

const {getAttempt,createPlan}=vi.hoisted(()=>({getAttempt:vi.fn(),createPlan:vi.fn()}));
vi.mock("@/lib/admin/instagram-story-repository",()=>({getInstagramStoryReconnectAttempt:getAttempt}));
vi.mock("@/lib/admin/instagram-story-service",()=>({createReconnectInstagramStoryPlan:createPlan}));

import {POST} from "@/app/api/admin/instagram-reconnect/complete/route";

const id="11111111-1111-4111-8111-111111111111";

describe("local Instagram reconnect completion",()=>{
  beforeEach(()=>{vi.clearAllMocks();createPlan.mockResolvedValue([{id:"story-1"}]);});

  it("schedules only after the home Mac verified the session",async()=>{
    getAttempt.mockResolvedValue({id,status:"connected"});
    const response=await POST(new Request("http://localhost",{method:"POST",body:JSON.stringify({id})}) as never);
    expect(response.status).toBe(200);
    expect(createPlan).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({count:1});
  });

  it("does not schedule an unverified request",async()=>{
    getAttempt.mockResolvedValue({id,status:"requested"});
    const response=await POST(new Request("http://localhost",{method:"POST",body:JSON.stringify({id})}) as never);
    expect(response.status).toBe(409);
    expect(createPlan).not.toHaveBeenCalled();
  });
});
