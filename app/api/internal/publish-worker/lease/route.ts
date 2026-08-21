import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {getDramaBySlug} from "@/lib/catalog";
import {leaseYixiaoerPackage} from "@/lib/admin/publish-repository";
import {getYixiaoerApiKey} from "@/lib/admin/yixiaoer";
import {listHookClips} from "@/lib/admin/hook-repository";
import {renderedHookCoverTimestamp} from "@/lib/hook-cover";
const schema=z.object({workerId:z.string().min(1),leaseSeconds:z.number().int().min(60).max(1800).default(600)});
function ok(r:NextRequest){const token=process.env.HOOK_WORKER_TOKEN;return Boolean(token&&(r.headers.get("x-hook-worker-token")===token||r.headers.get("authorization")===`Bearer ${token}`))}
export async function POST(request:NextRequest){
  if(!ok(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{
    const input=schema.parse(await request.json());
    const job=await leaseYixiaoerPackage(input.workerId,input.leaseSeconds);
    if(!job)return NextResponse.json({job:null});
    const drama=await getDramaBySlug(job.dramaSlug);
    const hook=job.videoKind==="hook"
      ?(await listHookClips(job.dramaSlug)).find(item=>item.id===job.hookClipId||item.videoUrl===job.videoUrl)
      :undefined;
    const coverTimestampSeconds=hook?renderedHookCoverTimestamp(hook):0;
    return NextResponse.json({job:{...job,coverTimestampSeconds,dramaTitle:drama?.title||job.dramaSlug,apiKey:await getYixiaoerApiKey()}});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not lease publish job"},{status:503})}
}
