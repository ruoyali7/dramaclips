import {NextRequest,NextResponse} from "next/server";
import {ensureDailyInstagramStoryPlan} from "@/lib/admin/instagram-story-service";

function authorized(request:NextRequest){const token=process.env.HOOK_WORKER_TOKEN;return Boolean(token&&(request.headers.get("x-hook-worker-token")===token||request.headers.get("authorization")===`Bearer ${token}`));}
export async function POST(request:NextRequest){
  if(!authorized(request))return NextResponse.json({message:"Unauthorized"},{status:401});
  try{const jobs=await ensureDailyInstagramStoryPlan();return NextResponse.json({jobs,count:jobs.length,pendingCount:jobs.filter(job=>job.status==="scheduled").length});}
  catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not create Story plan"},{status:503});}
}
