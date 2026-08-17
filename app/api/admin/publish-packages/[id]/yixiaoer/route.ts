import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getDramaBySlug} from "@/lib/catalog";
import {getPublishPackage,updatePublishPackageYixiaoer} from "@/lib/admin/publish-repository";
import {buildYixiaoerPayload,publishYixiaoerPayload,uploadYixiaoerVideo,validateYixiaoerPayload,yixiaoerPlatforms} from "@/lib/admin/yixiaoer";
export const runtime="nodejs";export const maxDuration=300;
const schema=z.object({action:z.enum(["validate","publish"]),confirm:z.boolean().optional(),accounts:z.record(z.string().trim().min(1))});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const input=schema.parse(await request.json());if(input.action==="publish"&&!input.confirm)return NextResponse.json({message:"Explicit final confirmation is required"},{status:409});
  const {id}=await params;const found=await getPublishPackage(id);if(!found)return NextResponse.json({message:"Publish package not found"},{status:404});let item=found;
  const drama=await getDramaBySlug(item.dramaSlug);if(!drama)return NextResponse.json({message:"Drama not found"},{status:404});
  const selected=item.platforms.filter(pack=>yixiaoerPlatforms.includes(pack.source));if(!selected.length)return NextResponse.json({message:"This package has no Yixiaoer-supported platforms"},{status:400});
  for(const pack of selected)if(!input.accounts[pack.source])return NextResponse.json({message:`Choose a Yixiaoer account for ${pack.source}`},{status:400});
  const pending=input.action==="publish"?selected.filter(pack=>!Boolean((item.yixiaoerResults[pack.source] as Record<string,unknown>|undefined)?.publish)):selected;
  if(input.action==="publish"&&!pending.length)return NextResponse.json({message:"All selected Yixiaoer platforms are already published"},{status:409});
  const video=Object.keys(item.yixiaoerVideo).length?item.yixiaoerVideo:await uploadYixiaoerVideo(item.videoUrl);
  const payloads=Object.fromEntries(selected.map(pack=>[pack.source,buildYixiaoerPayload(pack.source,input.accounts[pack.source],video,pack,`${drama.title} · EP ${item.episodeNumber}`)]));
  const results:Record<string,unknown>={...item.yixiaoerResults};
  for(const pack of pending){const checked=await validateYixiaoerPayload(pack.source,payloads[pack.source]);results[pack.source]=input.action==="publish"?{...checked,publish:await publishYixiaoerPayload(pack.source,payloads[pack.source])}:checked;item=await updatePublishPackageYixiaoer(id,{status:input.action==="publish"?"publishing":"ready",video,payloads,results})}
  const allHandled=item.platforms.every(pack=>!yixiaoerPlatforms.includes(pack.source)||Boolean((results[pack.source] as Record<string,unknown>|undefined)?.publish));const status=input.action==="publish"&&allHandled?"published":"ready";
  return NextResponse.json({package:await updatePublishPackageYixiaoer(id,{status,video,payloads,results}),results});
 }catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check action and account selections"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Yixiaoer operation failed"},{status:503})}
}
