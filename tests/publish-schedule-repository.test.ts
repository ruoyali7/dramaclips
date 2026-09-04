import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
vi.mock("@/lib/admin/supabase-config",()=>({getSupabaseConfig:()=>({configured:true,url:"https://supabase.test",key:"test-key"})}));
vi.mock("@/lib/admin/analytics-repository",()=>({createShortLink:vi.fn()}));
vi.mock("@/lib/admin/hashtag-recommendation",()=>({recommendHashtags:vi.fn(()=>[])}));

import {requestCancelYixiaoerPackage,rescheduleYixiaoerPackage} from "@/lib/admin/publish-repository";

const row={
  id:"package-1",drama_slug:"drama",episode_number:1,video_url:"https://video.test/1.mp4",video_kind:"hook",video_label:"Hook 1",account:"",campaign:"",
  scheduled_at:"2027-01-01T20:00:00.000Z",status:"scheduled",platforms:[],metricool_post_ids:{},yixiaoer_results:{_operation:{stage:"awaiting_scheduled_time"}},
  yixiaoer_action:"publish",yixiaoer_accounts:{},yixiaoer_progress:0,created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",
};

function response(value:unknown){return Promise.resolve(new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}}));}

describe("scheduled publish repository actions",()=>{
  beforeEach(()=>vi.stubGlobal("fetch",vi.fn()));

  it("reschedules only while the package is still unleased and clears a stale cancel request",async()=>{
    const next=new Date(Date.now()+3_600_000).toISOString();
    const canceledRow={...row,yixiaoer_results:{...row.yixiaoer_results,_control:{cancelRequested:true,requestedAt:"2026-01-01T00:00:00.000Z"}}};
    vi.mocked(fetch).mockImplementationOnce(()=>response([canceledRow])).mockImplementationOnce(()=>response([{...canceledRow,scheduled_at:next}]));
    const result=await rescheduleYixiaoerPackage(row.id,next);
    expect(result.scheduledAt).toBe(next);
    const [url,init]=vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toContain("status=eq.scheduled&yixiaoer_action=eq.publish&yixiaoer_lease_owner=is.null");
    const body=JSON.parse(String(init?.body));
    expect(body).toMatchObject({scheduled_at:next,yixiaoer_results:{_operation:{stage:"awaiting_scheduled_time",scheduledAt:next}}});
    expect(body.yixiaoer_results).not.toHaveProperty("_control");
  });

  it("cancels a waiting schedule with the same lease guard",async()=>{
    vi.mocked(fetch).mockImplementationOnce(()=>response([row])).mockImplementationOnce(()=>response([{...row,status:"ready",yixiaoer_action:null}]));
    const result=await requestCancelYixiaoerPackage(row.id);
    expect(result.status).toBe("ready");
    const [url]=vi.mocked(fetch).mock.calls[1];
    expect(String(url)).toContain("status=eq.scheduled&yixiaoer_lease_owner=is.null");
  });
});
