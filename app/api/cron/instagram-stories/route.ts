import {NextRequest,NextResponse} from "next/server";
import {createReconnectInstagramStoryPlan} from "@/lib/admin/instagram-story-service";

export async function GET(request:NextRequest){
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({message:"Unauthorized"},{status:401});
  try{
    const jobs=await createReconnectInstagramStoryPlan();
    return NextResponse.json({jobs,count:jobs.length});
  }catch(error){
    return NextResponse.json({message:error instanceof Error?error.message:"Could not schedule today’s Stories"},{status:503});
  }
}
