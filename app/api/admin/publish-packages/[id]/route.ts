import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getPublishPackage,publishingPlatforms,updatePublishPackagePlatforms} from "@/lib/admin/publish-repository";

const platformSchema=z.object({source:z.enum(publishingPlatforms),shortCode:z.string().max(100),url:z.string().url(),hook:z.string().max(500),caption:z.string().max(10000)});
const schema=z.object({platforms:z.array(platformSchema).min(1).max(5)});

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;const input=schema.parse(await request.json());const item=await getPublishPackage(id);
  if(!item)return NextResponse.json({message:"Publish package not found"},{status:404});
  if(item.yixiaoerAction)return NextResponse.json({message:"Copy cannot be edited while a publish operation is running"},{status:409});
  if(item.status==="published")return NextResponse.json({message:"Published copy is locked"},{status:409});
  const existing=new Map(item.platforms.map(platform=>[platform.source,platform]));
  const platforms=input.platforms.map(platform=>{const original=existing.get(platform.source);if(!original)throw new Error(`Unknown platform ${platform.source}`);return{...original,hook:platform.hook,caption:platform.caption}});
  return NextResponse.json({package:await updatePublishPackagePlatforms(id,platforms)});
 }catch(error){
  if(error instanceof ZodError)return NextResponse.json({message:"Check the generated copy"},{status:400});
  return NextResponse.json({message:error instanceof Error?error.message:"Could not update publish package"},{status:503});
 }
}
