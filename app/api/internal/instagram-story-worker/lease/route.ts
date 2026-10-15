import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {leaseInstagramStoryJob} from "@/lib/admin/instagram-story-repository";

const schema=z.object({workerId:z.string().min(1),leaseSeconds:z.number().int().min(60).max(1800).default(300)});
function authorized(request:NextRequest){const token=process.env.HOOK_WORKER_TOKEN;return Boolean(token&&(request.headers.get("x-hook-worker-token")===token||request.headers.get("authorization")===`Bearer ${token}`));}
export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{const input=schema.parse(await request.json());return NextResponse.json({job:await leaseInstagramStoryJob(input.workerId,input.leaseSeconds)});}
  catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not lease Story job"},{status:503});}
}
