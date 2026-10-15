import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {getInstagramStoryConnectionStatus,saveInstagramStorySessionId} from "@/lib/admin/instagram-story-repository";

const inputSchema=z.object({sessionId:z.string().trim().min(20).max(500).refine(value=>!(/\s/.test(value))) });

export async function GET(){
  try{return NextResponse.json({connection:await getInstagramStoryConnectionStatus()});}
  catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not load Instagram connection"},{status:503});}
}

export async function POST(request:NextRequest){
  try{
    const {sessionId}=inputSchema.parse(await request.json());
    await saveInstagramStorySessionId(sessionId);
    return NextResponse.json({connection:await getInstagramStoryConnectionStatus()});
  }catch(error){
    if(error instanceof ZodError)return NextResponse.json({message:"No valid signed-in Instagram session was found"},{status:400});
    return NextResponse.json({message:error instanceof Error?error.message:"Could not save Instagram connection"},{status:503});
  }
}
