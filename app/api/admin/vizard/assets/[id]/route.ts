import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {reviewVizardAsset} from "@/lib/admin/vizard-repository";
const schema=z.object({action:z.enum(["approve","delete"])});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;const {action}=schema.parse(await request.json());return NextResponse.json({asset:await reviewVizardAsset(id,action)})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not review Vizard hook"},{status:409})}}
