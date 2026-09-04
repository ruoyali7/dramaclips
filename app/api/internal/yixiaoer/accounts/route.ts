import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {getYixiaoerApiKey} from "@/lib/admin/yixiaoer";
import {saveCachedYixiaoerAccounts} from "@/lib/admin/yixiaoer-account-cache";
import {saveYixiaoerWorkerApiKey} from "@/lib/admin/yixiaoer-vault";

const account=z.object({id:z.string().min(1),name:z.string().min(1),platform:z.string(),status:z.number().int(),avatar:z.string().optional()});
const schema=z.object({workerId:z.string().min(3).max(120),accounts:z.array(account).optional()});
function authorized(request:NextRequest){const token=process.env.HOOK_WORKER_TOKEN;return Boolean(token&&(request.headers.get("x-hook-worker-token")===token||request.headers.get("authorization")===`Bearer ${token}`))}

export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{
    const input=schema.parse(await request.json());
    if(!input.accounts){const apiKey=await getYixiaoerApiKey();await saveYixiaoerWorkerApiKey(apiKey);return NextResponse.json({apiKey});}
    return NextResponse.json(await saveCachedYixiaoerAccounts(input.accounts));
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not synchronize Yixiaoer accounts"},{status:503})}
}
