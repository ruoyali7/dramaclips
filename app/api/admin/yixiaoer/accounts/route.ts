import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {listYixiaoerAccounts,yixiaoerConfigured,yixiaoerPlatforms} from "@/lib/admin/yixiaoer";
const schema=z.enum(yixiaoerPlatforms as [string,...string[]]);
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{if(!yixiaoerConfigured())return NextResponse.json({configured:false,accounts:[]});const value=request.nextUrl.searchParams.get("platform");const platform=value?schema.parse(value):undefined;return NextResponse.json({configured:true,accounts:await listYixiaoerAccounts(platform as never)})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Unsupported Yixiaoer platform"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not load Yixiaoer accounts"},{status:503})}}
