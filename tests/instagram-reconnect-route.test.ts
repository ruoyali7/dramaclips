import {beforeEach,describe,expect,it,vi} from "vitest";
import {NextRequest} from "next/server";

const {getActive,createAttempt,getAttempt,confirmApproval}=vi.hoisted(()=>({
  getActive:vi.fn(),createAttempt:vi.fn(),getAttempt:vi.fn(),confirmApproval:vi.fn(),
}));
vi.mock("@/lib/admin/instagram-story-repository",()=>({
  getActiveInstagramStoryReconnectAttempt:getActive,
  createInstagramStoryReconnectAttempt:createAttempt,
  getInstagramStoryReconnectAttempt:getAttempt,
  confirmInstagramStoryReconnectApproval:confirmApproval,
}));

import {GET,PATCH,POST} from "@/app/api/admin/instagram-reconnect/route";

const attempt={id:"11111111-1111-4111-8111-111111111111",status:"requested",requested_at:"2026-10-17T18:00:00Z",expires_at:"2026-10-17T18:05:00Z",updated_at:"2026-10-17T18:00:00Z"};

describe("mobile Instagram reconnect route",()=>{
  beforeEach(()=>{vi.clearAllMocks();getActive.mockResolvedValue(null);createAttempt.mockResolvedValue(attempt);});

  it("queues one request for the home Mac agent",async()=>{
    const response=await POST();
    expect(response.status).toBe(202);
    expect(createAttempt).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({attempt,runner:"local"});
  });

  it("reuses an active reconnect instead of sending another login",async()=>{
    getActive.mockResolvedValue({...attempt,status:"waiting_for_approval"});
    const response=await POST();
    expect(response.status).toBe(202);
    expect(createAttempt).not.toHaveBeenCalled();
  });

  it("records approval and exposes reconnect status",async()=>{
    const waiting={...attempt,status:"waiting_for_approval"};
    confirmApproval.mockResolvedValue(waiting);getAttempt.mockResolvedValue(waiting);
    const patchResponse=await PATCH(new Request("http://localhost/api/admin/instagram-reconnect",{method:"PATCH",body:JSON.stringify({id:attempt.id,approved:true})}) as never);
    expect(patchResponse.status).toBe(200);
    expect(confirmApproval).toHaveBeenCalledWith(attempt.id);
    const getResponse=await GET(new NextRequest(`http://localhost/api/admin/instagram-reconnect?id=${attempt.id}`));
    expect(getResponse.status).toBe(200);
    await expect(getResponse.json()).resolves.toEqual({attempt:waiting});
  });
});
