import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {enqueueYixiaoerPackage,getPublishPackage,requestCancelYixiaoerPackage} from "@/lib/admin/publish-repository";
import {yixiaoerPlatforms} from "@/lib/admin/yixiaoer";

const schema=z.object({action:z.enum(["validate","publish","cancel"]),confirm:z.boolean().optional(),accounts:z.record(z.string().trim().min(1)).default({})});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const input=schema.parse(await request.json());const {id}=await params;
    if(input.action==="cancel")return NextResponse.json({package:await requestCancelYixiaoerPackage(id)},{status:202});
    if(input.action==="publish"&&!input.confirm)return NextResponse.json({message:"Explicit final confirmation is required"},{status:409});
    const item=await getPublishPackage(id);if(!item)return NextResponse.json({message:"Publish package not found"},{status:404});
    const uncertain=Object.values(item.yixiaoerResults||{}).some(value=>value&&typeof value==="object"&&(value as Record<string,unknown>).state==="outcome_unknown");
    if(uncertain)return NextResponse.json({message:"This package has an unresolved provider outcome. Automatic retry is blocked to prevent a duplicate post; reconcile the Yixiaoer task before retrying."},{status:409});
    const selected=item.platforms.filter(pack=>yixiaoerPlatforms.includes(pack.source));if(!selected.length)return NextResponse.json({message:"This package has no Yixiaoer-supported platforms"},{status:400});
    for(const pack of selected)if(!input.accounts[pack.source])return NextResponse.json({message:`Choose a Yixiaoer account for ${pack.source}`},{status:400});
    if(item.yixiaoerAction)return NextResponse.json({message:"A Yixiaoer operation is already running"},{status:409});
    if(input.action==="publish"&&item.status!=="ready")return NextResponse.json({message:"Run upload, validate & dry-run before live publishing"},{status:409});
    return NextResponse.json({package:await enqueueYixiaoerPackage(id,{action:input.action,accounts:input.accounts})},{status:202});
  }catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check action and account selections"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not queue Yixiaoer operation"},{status:503})}
}
