import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {confirmInstagramStoryReconnectApproval,createInstagramStoryReconnectAttempt,getActiveInstagramStoryReconnectAttempt,getInstagramStoryReconnectAttempt} from "@/lib/admin/instagram-story-repository";

const querySchema=z.object({id:z.string().uuid()});
const approvalSchema=z.object({id:z.string().uuid(),approved:z.literal(true)});

export async function GET(request:NextRequest){
  try{
    const {id}=querySchema.parse({id:request.nextUrl.searchParams.get("id")});
    const attempt=await getInstagramStoryReconnectAttempt(id);
    return attempt?NextResponse.json({attempt}):NextResponse.json({message:"Reconnect attempt not found"},{status:404});
  }catch(error){
    if(error instanceof ZodError)return NextResponse.json({message:"Invalid reconnect attempt"},{status:400});
    return NextResponse.json({message:error instanceof Error?error.message:"Could not load reconnect status"},{status:503});
  }
}

export async function POST(){
  try{
    const existing=await getActiveInstagramStoryReconnectAttempt();
    if(existing)return NextResponse.json({attempt:existing,reused:true},{status:202});
    const attempt=await createInstagramStoryReconnectAttempt();
    return NextResponse.json({attempt,runner:"local"},{status:202});
  }catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not start Instagram reconnect"},{status:503});}
}

export async function PATCH(request:NextRequest){
  try{
    const {id}=approvalSchema.parse(await request.json());
    const attempt=await confirmInstagramStoryReconnectApproval(id);
    return attempt?NextResponse.json({attempt}):NextResponse.json({message:"Reconnect is not waiting for approval"},{status:409});
  }catch(error){
    if(error instanceof ZodError)return NextResponse.json({message:"Invalid approval confirmation"},{status:400});
    return NextResponse.json({message:error instanceof Error?error.message:"Could not continue reconnect"},{status:503});
  }
}
