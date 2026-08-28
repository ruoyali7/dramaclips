import {NextRequest,NextResponse} from "next/server";
import {z,ZodError} from "zod";
import {listYixiaoerAccounts,yixiaoerConfigured,yixiaoerPlatformName,yixiaoerPlatforms} from "@/lib/admin/yixiaoer";
import {getCachedYixiaoerAccounts} from "@/lib/admin/yixiaoer-account-cache";
const schema=z.enum(yixiaoerPlatforms as [string,...string[]]);
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){try{if(!await yixiaoerConfigured())return NextResponse.json({configured:false,accounts:[]});const value=request.nextUrl.searchParams.get("platform");const platform=value?schema.parse(value):undefined;const cached=await getCachedYixiaoerAccounts().catch(()=>null);if(cached){const accounts=platform?cached.accounts.filter(account=>account.platform===yixiaoerPlatformName(platform as never)):cached.accounts;return NextResponse.json({configured:true,accounts,source:"railway-cache",syncedAt:cached.syncedAt})}return NextResponse.json({configured:true,accounts:await listYixiaoerAccounts(platform as never),source:"direct"})}catch(error){if(error instanceof ZodError)return NextResponse.json({message:"Unsupported Yixiaoer platform"},{status:400});return NextResponse.json({message:error instanceof Error?error.message:"Could not load Yixiaoer accounts"},{status:503})}}
