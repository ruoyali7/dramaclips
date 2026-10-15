import {beforeEach,describe,expect,it,vi} from "vitest";

const {getStatus,saveSessionId}=vi.hoisted(()=>({getStatus:vi.fn(),saveSessionId:vi.fn()}));
vi.mock("@/lib/admin/instagram-story-repository",()=>({
  getInstagramStoryConnectionStatus:getStatus,
  saveInstagramStorySessionId:saveSessionId,
}));
import {GET,POST} from "@/app/api/admin/instagram-session/route";

function request(sessionId:unknown){return new Request("http://localhost/api/admin/instagram-session",{method:"POST",body:JSON.stringify({sessionId})});}

describe("Instagram session admin route",()=>{
  beforeEach(()=>{getStatus.mockReset();saveSessionId.mockReset();});

  it("stores a valid session without returning its value",async()=>{
    const sessionId="123456789%3Aauthenticated-instagram-session";
    saveSessionId.mockResolvedValue("2026-10-15T12:00:00Z");
    getStatus.mockResolvedValue({sessionIdConfigured:true,settingsConfigured:false});
    const response=await POST(request(sessionId) as never);
    const body=await response.json();
    expect(response.status).toBe(200);
    expect(saveSessionId).toHaveBeenCalledWith(sessionId);
    expect(JSON.stringify(body)).not.toContain(sessionId);
  });

  it("rejects missing or malformed session values",async()=>{
    expect((await POST(request("") as never)).status).toBe(400);
    expect((await POST(request("invalid session value with spaces") as never)).status).toBe(400);
    expect(saveSessionId).not.toHaveBeenCalled();
  });

  it("returns only connection status",async()=>{
    getStatus.mockResolvedValue({sessionIdConfigured:false,settingsConfigured:true});
    const response=await GET();
    await expect(response.json()).resolves.toEqual({connection:{sessionIdConfigured:false,settingsConfigured:true}});
  });
});
