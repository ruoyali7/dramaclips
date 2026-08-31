import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {enqueueYixiaoerPackage,getPublishPackage,requestCancelYixiaoerPackage,rescheduleYixiaoerPackage} from "@/lib/admin/publish-repository";
import {yixiaoerPlatforms} from "@/lib/admin/yixiaoer";

const schema=z.object({action:z.enum(["draft","validate","publish","cancel","reschedule","reconcile","retry","retry-upload"]),platform:z.string().trim().optional(),confirm:z.boolean().optional(),deliveryMode:z.enum(["now","scheduled"]).optional(),scheduledAt:z.string().datetime().optional(),accounts:z.record(z.string().trim().min(1)).default({})});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  try{
    const input=schema.parse(await request.json());const {id}=await params;
    if(input.action==="cancel")return NextResponse.json({package:await requestCancelYixiaoerPackage(id)},{status:202});
    if(input.action==="reschedule"){
      if(!input.scheduledAt)return NextResponse.json({message:"Choose a scheduled time in the future"},{status:400});
      return NextResponse.json({package:await rescheduleYixiaoerPackage(id,input.scheduledAt)});
    }
    if(input.action==="reconcile"&&!input.platform)return NextResponse.json({message:"Choose a platform to reconcile"},{status:400});
    if(input.action==="publish"&&!input.confirm)return NextResponse.json({message:"Explicit final confirmation is required"},{status:409});
    const item=await getPublishPackage(id);if(!item)return NextResponse.json({message:"Publish package not found"},{status:404});
    const uncertain=Object.values(item.yixiaoerResults||{}).some(value=>value&&typeof value==="object"&&(value as Record<string,unknown>).state==="outcome_unknown");
    if(uncertain&&!(["reconcile"].includes(input.action)))return NextResponse.json({message:"This package has an unresolved provider outcome. Reconcile that platform before retrying to prevent a duplicate post."},{status:409});
    const selected=item.platforms.filter(pack=>yixiaoerPlatforms.includes(pack.source));if(!selected.length)return NextResponse.json({message:"This package has no Yixiaoer-supported platforms"},{status:400});
    for(const pack of selected)if(!input.accounts[pack.source])return NextResponse.json({message:`Choose a Yixiaoer account for ${pack.source}`},{status:400});
    if(item.yixiaoerAction)return NextResponse.json({message:"A Yixiaoer operation is already running"},{status:409});
    if(input.action==="retry-upload"){
      const operation=item.yixiaoerResults?._operation as Record<string,unknown>|undefined;const stage=String(operation?.stage||"");
      if(item.status!=="failed"||(!stage.includes("upload")&&stage!=="downloading_from_r2"))return NextResponse.json({message:"Only a failed upload can be retried here"},{status:409});
      const intent=item.yixiaoerResults?._intent as Record<string,unknown>|undefined;const draft=intent?.deliveryMode==="draft";
      return NextResponse.json({package:await enqueueYixiaoerPackage(id,{action:draft?"validate":"publish",accounts:input.accounts,control:draft?{saveDraft:true}:undefined})},{status:202});
    }
    if(input.action==="publish"&&item.status!=="ready")return NextResponse.json({message:"Run upload, validate & dry-run before live publishing"},{status:409});
    const retryPlatforms=input.action==="retry"?selected.filter(pack=>{
      const result=item.yixiaoerResults?.[pack.source];
      return result&&typeof result==="object"&&(result as Record<string,unknown>).state==="failed";
    }).map(pack=>pack.source):undefined;
    if(input.action==="retry"&&!retryPlatforms?.length)return NextResponse.json({message:"No confirmed failed platforms can be retried"},{status:409});
    if(input.action==="retry"&&input.deliveryMode==="scheduled"&&(!input.scheduledAt||new Date(input.scheduledAt).getTime()<=Date.now()))return NextResponse.json({message:"Choose a scheduled time in the future"},{status:400});
    const action=input.action==="reconcile"||input.action==="retry"?"publish":input.action==="draft"?"validate":input.action;
    const control=input.action==="reconcile"?{reconcilePlatforms:[input.platform!]}:input.action==="retry"?{retryPlatforms}:input.action==="draft"?{saveDraft:true}:undefined;
    return NextResponse.json({package:await enqueueYixiaoerPackage(id,{action,accounts:input.accounts,control,scheduledAt:input.action==="retry"&&input.deliveryMode==="scheduled"?input.scheduledAt:undefined,clearSchedule:input.action==="retry"&&input.deliveryMode==="now"})},{status:202});
  }catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Check action and account selections"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not queue Yixiaoer operation"},{status:503})}
}
