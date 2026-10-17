import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getInstagramStoryReconnectAttempt} from "@/lib/admin/instagram-story-repository";
import {createReconnectInstagramStoryPlan} from "@/lib/admin/instagram-story-service";

const schema=z.object({id:z.string().uuid()});

export async function POST(request:NextRequest){
  try{
    const {id}=schema.parse(await request.json());
    const attempt=await getInstagramStoryReconnectAttempt(id);
    if(!attempt||attempt.status!=="connected")return NextResponse.json({message:"The home Mac has not verified Instagram yet"},{status:409});
    const jobs=await createReconnectInstagramStoryPlan();
    return NextResponse.json({jobs,count:jobs.length});
  }catch(error){
    if(error instanceof ZodError)return NextResponse.json({message:"Invalid local Story request"},{status:400});
    return NextResponse.json({message:error instanceof Error?error.message:"Could not schedule today’s Stories"},{status:503});
  }
}
