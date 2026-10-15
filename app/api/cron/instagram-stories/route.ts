import {NextRequest,NextResponse} from "next/server";
import {triggerRailwayWorker} from "@/lib/admin/railway-worker-trigger";

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({message:"Unauthorized"},{status:401});
  const workerTrigger=await triggerRailwayWorker("story");
  return NextResponse.json({workerTrigger},{status:workerTrigger.status==="failed"?503:202});
}
