import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("@/lib/admin/supabase-config",()=>({getSupabaseConfig:()=>({configured:true,url:"https://supabase.test",key:"test"})}));
vi.mock("@/lib/admin/analytics-repository",()=>({createShortLink:vi.fn()}));
vi.mock("@/lib/admin/hashtag-recommendation",()=>({recommendHashtags:vi.fn(()=>[])}));
vi.mock("@/lib/admin/r2",()=>({listExpiredHookDrafts:vi.fn(async()=>[]),deleteExpiredHookDrafts:vi.fn()}));
import {listPublishPackages,listPublishedAssetIdentities} from "@/lib/admin/publish-repository";
import {createStorageCleanupPlan,executeStorageCleanup} from "@/lib/admin/storage-cleanup";
afterEach(()=>vi.unstubAllGlobals());
describe("publish history retention",()=>{
 it("reads past the first history page",async()=>{
  const fetcher=vi.fn(async(input:string)=>new Response(JSON.stringify(Array.from({length:input.includes("offset=0")?200:7},(_,i)=>({id:input+String(i),video_url:"https://cdn.test/video",status:"published",platforms:[],created_at:"2026-01-01"})))));
  vi.stubGlobal("fetch",fetcher);expect(await listPublishPackages()).toHaveLength(207);expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it("paginates historical published identities too",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(input:string)=>new Response(JSON.stringify(Array.from({length:input.includes("offset=0")?200:1},()=>({video_url:"https://cdn.test/video"}))))));expect(await listPublishedAssetIdentities()).toHaveLength(201);
 });
 it("never includes old failures or partial results in cleanup",async()=>{
  const fetcher=vi.fn(async(input:string,_init?:RequestInit)=>new Response(JSON.stringify(input.includes("publish_packages?")?[{id:"old",status:"failed",created_at:"2020-01-01",yixiaoer_results:{facebook:{state:"published"}}}]:[])));
  vi.stubGlobal("fetch",fetcher);const plan=await createStorageCleanupPlan();expect(plan.categories.publishPackages).toEqual([]);await executeStorageCleanup(plan.fingerprint);expect(fetcher.mock.calls.every(call=>!(call[1] as RequestInit|undefined)?.method)).toBe(true);
 });
});
