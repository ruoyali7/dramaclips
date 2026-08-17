import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {updateYixiaoerWorkerPackage} from "@/lib/admin/publish-repository";

const schema=z.object({
  workerId:z.string(),
  status:z.enum(["validating","ready","scheduled","publishing","submitted","reconciling","published","failed","outcome_unknown"]),
  progress:z.number().int().min(0).max(100),
  video:z.record(z.unknown()).optional(),payloads:z.record(z.unknown()).optional(),results:z.record(z.unknown()).optional(),
  error:z.string().max(1000).optional(),terminal:z.boolean().default(false),
});
function ok(request:NextRequest){const token=process.env.HOOK_WORKER_TOKEN;return Boolean(token&&(request.headers.get("x-hook-worker-token")===token||request.headers.get("authorization")===`Bearer ${token}`))}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  if(!ok(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{const input=schema.parse(await request.json());const {id}=await params;return NextResponse.json({package:await updateYixiaoerWorkerPackage(id,input.workerId,input)})}
  catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not update publish job"},{status:409})}
}
