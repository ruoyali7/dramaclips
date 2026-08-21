import {describe,expect,it} from "vitest";
import {buildYixiaoerPayload,plainYixiaoerDescription,yixiaoerPlatformName} from "@/lib/admin/yixiaoer";
const video={key:"cloud-publish/video.mp4",size:100,width:1080,height:1920};
describe("Yixiaoer publishing payloads",()=>{
 it("maps DramaClip platforms to official Yixiaoer names",()=>{expect(yixiaoerPlatformName("youtube")).toBe("Youtube");expect(yixiaoerPlatformName("tiktok")).toBe("TikTok")});
 it("builds a standard TikTok video payload",()=>{const payload=buildYixiaoerPayload("tiktok","account-1",video,{source:"tiktok",caption:"Watch now"},"Drama · EP 1") as any;expect(payload.publishType).toBe("video");expect(payload.publishArgs.video).toEqual(video);expect(payload.publishArgs.accountForms[0]).toMatchObject({platformAccountId:"account-1",contentPublishForm:{formType:"task",description:"Watch now",visible:"public"}})});
 it("builds required YouTube title fields",()=>{const payload=buildYixiaoerPayload("youtube","account-2",video,{source:"youtube",caption:"Description"},"Drama · EP 2") as any;expect(payload.publishArgs.accountForms[0].contentPublishForm).toMatchObject({title:"Drama · EP 2",madeForKids:false,visible:"public"})});
 it("removes provider HTML and hashtag markup from descriptions",()=>{expect(plainYixiaoerDescription('<p>Watch now</p><p><topic text="DramaClips">#DramaClips</topic></p>')).toBe("Watch now".trim())});
});
