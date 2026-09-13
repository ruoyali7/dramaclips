import {describe,it,expect,beforeEach,vi} from "vitest";
import {isReadyDramaVideo,nextEpisodeNumber} from "@/lib/drama-onboarding";
import {dramaDraftSchema} from "@/lib/admin/drama-schema";
const {get,update,enqueue}=vi.hoisted(()=>({get:vi.fn(),update:vi.fn(),enqueue:vi.fn()}));
vi.mock("@/lib/admin/repository",()=>({getDramaForEdit:get,updateDrama:update,deleteDrama:vi.fn()}));
vi.mock("@/lib/admin/vizard-repository",()=>({enqueueVizardSubmissions:enqueue}));
import {PATCH} from "@/app/api/admin/dramas/[id]/route";
import {POST} from "@/app/api/admin/dramas/[id]/queue/route";
const body={title:"Drama",slug:"drama",publicCode:"1234",promoCode:"1234",language:"en",tags:[],description:"A sufficiently long description.",coverUrl:"/cover.jpg",episodes:[{episodeNumber:1,videoUrl:"https://cdn.test/replaced.mp4"},{episodeNumber:3,videoUrl:"https://cdn.test/3.mp4"}]};
describe("drama onboarding",()=>{
 beforeEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();get.mockResolvedValue({id:"d",...body,episodes:[{episodeNumber:1,videoUrl:"https://cdn.test/1.mp4"}]});update.mockResolvedValue({id:"d",title:"Drama",slug:"drama"});enqueue.mockResolvedValue([{id:"q"}]);});
 it("rejects source links and other origins when R2 is configured",()=>{
  expect(isReadyDramaVideo("https://v-mps.crazymaplestudios.com/1.mp4")).toBe(false);
  expect(isReadyDramaVideo("https://v-out.oss-accelerate.aliyuncs.com/1.mp4?signature=x")).toBe(false);
  expect(isReadyDramaVideo("https://other.test/1.mp4","https://cdn.test")).toBe(false);
  expect(isReadyDramaVideo("https://cdn.test/dramas/1.mp4","https://cdn.test")).toBe(true);
 });
 it("does not reuse a preserved episode number after removal",()=>{expect(nextEpisodeNumber([{episodeNumber:1},{episodeNumber:3}])).toBe(4);});
 it("rejects duplicate episode numbers and non-R2 videos server-side",()=>{
  vi.stubEnv("R2_PUBLIC_BASE_URL","https://cdn.test");
  const schema=dramaDraftSchema.shape.episodes;
  expect(schema.safeParse([{episodeNumber:1,videoUrl:"https://other.test/video.mp4"}]).success).toBe(false);
  expect(schema.safeParse([body.episodes[0],body.episodes[0]]).success).toBe(false);
 });
 it("queues only new episodes on edit and reports replaced media",async()=>{
  const response=await PATCH(new Request("http://local",{method:"PATCH",body:JSON.stringify(body)}) as never,{params:Promise.resolve({id:"d"})});
  const data=await response.json();expect(response.status).toBe(200);expect(enqueue.mock.calls[0][0].map((x:{episodeNumber:number})=>x.episodeNumber)).toEqual([3]);expect(data.changedEpisodes).toEqual([1]);expect(data.queueEpisodeNumbers).toEqual([3]);
 });
 it("keeps a saved edit successful when queueing fails",async()=>{
  enqueue.mockRejectedValue(new Error("offline"));const response=await PATCH(new Request("http://local",{method:"PATCH",body:JSON.stringify(body)}) as never,{params:Promise.resolve({id:"d"})});expect(response.status).toBe(200);expect((await response.json()).vizard.status).toBe("failed");
 });
 it("retries only requested queue episodes without saving the drama again",async()=>{
  get.mockResolvedValue({id:"d",...body});const response=await POST(new Request("http://local",{method:"POST",body:JSON.stringify({episodeNumbers:[3]})}),{params:Promise.resolve({id:"d"})});expect(response.status).toBe(200);expect(update).not.toHaveBeenCalled();expect(enqueue.mock.calls[0][0].map((x:{episodeNumber:number})=>x.episodeNumber)).toEqual([3]);
 });
});
