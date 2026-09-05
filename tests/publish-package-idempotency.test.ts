import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
vi.mock("@/lib/admin/supabase-config",()=>({getSupabaseConfig:()=>({configured:true,url:"https://supabase.test",key:"test-key"})}));
vi.mock("@/lib/admin/analytics-repository",()=>({createShortLink:vi.fn()}));
vi.mock("@/lib/admin/hashtag-recommendation",()=>({recommendHashtags:vi.fn(()=>[])}));

import {createPublishPackage,enqueueYixiaoerPackage,ExistingPublishPackageError} from "@/lib/admin/publish-repository";

const existing={
  id:"package-1",drama_slug:"drama",episode_number:1,video_url:"https://video.test/hook.mp4",video_kind:"hook",video_label:"Hook 1",hook_clip_id:"11111111-1111-4111-8111-111111111111",account:"main",campaign:"organic",
  scheduled_at:"2027-01-01T20:00:00.000Z",status:"scheduled",platforms:[],metricool_post_ids:{},yixiaoer_results:{},yixiaoer_action:"publish",yixiaoer_accounts:{},yixiaoer_progress:0,created_at:"2026-01-01T00:00:00.000Z",updated_at:"2026-01-01T00:00:00.000Z",
};

function response(value:unknown){return Promise.resolve(new Response(JSON.stringify(value),{status:200,headers:{"content-type":"application/json"}}));}

describe("publish package idempotency",()=>{
  beforeEach(()=>vi.stubGlobal("fetch",vi.fn()));

  it("returns the existing task instead of creating another task for the same hook",async()=>{
    vi.mocked(fetch)
      .mockImplementationOnce(()=>response([]))
      .mockImplementationOnce(()=>response([{id:existing.hook_clip_id}]))
      .mockImplementationOnce(()=>response([existing]))
      .mockImplementationOnce(()=>response([existing]));

    const action=createPublishPackage({
      dramaSlug:"drama",title:"Drama",promoCode:"CODE",description:"Description.",tags:[],episodeNumber:1,
      videoUrl:existing.video_url,videoKind:"hook",videoLabel:"Hook 1",hookClipId:existing.hook_clip_id,
      deliveryMode:"scheduled",scheduledAt:"2027-01-01T20:00:00.000Z",platforms:["tiktok"],siteUrl:"https://dramaclips.test",
    });

    await expect(action).rejects.toMatchObject({
      name:"ExistingPublishPackageError",
      packageItem:{id:existing.id,status:"scheduled"},
    });
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4);
    await action.catch((error)=>expect(error).toBeInstanceOf(ExistingPublishPackageError));
  });

  it("does not enqueue an old task when another task for the hook is active or published",async()=>{
    const published={...existing,id:"package-published",status:"published",yixiaoer_action:null};
    vi.mocked(fetch)
      .mockImplementationOnce(()=>response([{...existing,status:"failed",yixiaoer_action:null}]))
      .mockImplementationOnce(()=>response([published]));

    await expect(enqueueYixiaoerPackage(existing.id,{action:"publish",accounts:{tiktok:"account-1"}}))
      .rejects.toMatchObject({name:"ExistingPublishPackageError",packageItem:{id:published.id}});
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("clears stale control state whenever a package is enqueued again",async()=>{
    const retryable={...existing,video_kind:"episode",hook_clip_id:null,status:"failed",yixiaoer_action:null,yixiaoer_results:{_control:{cancelRequested:true},_operation:{stage:"canceled"}}};
    vi.mocked(fetch)
      .mockImplementationOnce(()=>response([retryable]))
      .mockImplementationOnce(()=>response([{...retryable,status:"scheduled"}]));

    await enqueueYixiaoerPackage(retryable.id,{action:"publish",accounts:{tiktok:"account-1"},scheduledAt:"2027-01-02T20:00:00.000Z"});

    const body=JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body));
    expect(body.yixiaoer_results).not.toHaveProperty("_control");
    expect(body.yixiaoer_results._operation.stage).toBe("awaiting_scheduled_time");
  });
});
