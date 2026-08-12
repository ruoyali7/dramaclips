import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { readFile,rm } from "fs/promises";
import path from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { deleteDrama,getDramaForEdit,getPublishedDramaDrafts,listDramaDrafts,publishDramaDraft,saveDramaDraft,updateDrama } from "@/lib/admin/draft-repository";
import { dramaDraftSchema } from "@/lib/admin/drama-schema";

describe("drama draft lifecycle",()=>{
  const dir=path.join(tmpdir(),`dramaclips-${randomUUID()}`);
  const file=path.join(dir,"drafts.json");
  beforeEach(()=>{process.env.DRAMA_DRAFT_FILE=file;process.env.CPS_URL_ENCRYPTION_KEY="2".repeat(64)});
  afterEach(async()=>{delete process.env.DRAMA_DRAFT_FILE;await rm(dir,{recursive:true,force:true})});
  const input={title:"Test Drama",slug:"test-drama",publicCode:"9876",promoCode:"9876",language:"en",tags:["Drama"],description:"A sufficiently detailed description for the test drama.",coverUrl:"/test.jpg",cpsUrl:"https://reelslink.com/cps/secret-token",episodes:[{episodeNumber:1,videoUrl:"https://media.example.test/e1.mp4"}]};

  it("saves encrypted, lists safely, and publishes",async()=>{const saved=await saveDramaDraft(input);const disk=await readFile(file,"utf8");expect(disk).not.toContain("secret-token");expect((await listDramaDrafts())[0]).not.toHaveProperty("cpsUrlEncrypted");await publishDramaDraft(saved.id);const published=await getPublishedDramaDrafts();expect(published).toHaveLength(1);expect(published[0].status).toBe("published")});

  it("edits without exposing or replacing a saved CPS link, then deletes the record",async()=>{const saved=await saveDramaDraft(input);const editable=await getDramaForEdit(saved.id);expect(editable).toMatchObject({title:"Test Drama",hasCpsUrl:true});expect(editable).not.toHaveProperty("cpsUrlEncrypted");await updateDrama(saved.id,{...input,title:"Updated Drama",coverUrl:"https://media.example.test/cover.jpg",cpsUrl:undefined});expect(await readFile(file,"utf8")).not.toContain("secret-token");expect(await getDramaForEdit(saved.id)).toMatchObject({title:"Updated Drama",coverUrl:"https://media.example.test/cover.jpg"});await deleteDrama(saved.id);expect(await getDramaForEdit(saved.id)).toBeNull()});

  it("accepts a thirteen-episode preview bundle",()=>{const episodes=Array.from({length:13},(_,index)=>({episodeNumber:index+1,videoUrl:`https://media.example.test/e${index+1}.mp4`}));expect(dramaDraftSchema.parse({...input,episodes}).episodes).toHaveLength(13)});
});
