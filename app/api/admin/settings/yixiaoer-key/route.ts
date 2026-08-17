import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {saveRuntimeSecret} from "@/lib/admin/runtime-secret-repository";
import {validateYixiaoerApiKey} from "@/lib/admin/yixiaoer";

export const runtime="nodejs";export const maxDuration=60;
const schema=z.object({apiKey:z.string().trim().min(16).max(4096)});
export async function PUT(request:NextRequest){try{const {apiKey}=schema.parse(await request.json());const accounts=await validateYixiaoerApiKey(apiKey);const saved=await saveRuntimeSecret("yixiaoer_api_key",apiKey);return NextResponse.json({...saved,accountCount:accounts.length,platforms:Array.from(new Set(accounts.map(account=>account.platform)))})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Paste a valid Yixiaoer API Key"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not verify Yixiaoer API Key"},{status:503})}}
