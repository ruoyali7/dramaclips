import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {createStorageCleanupPlan,executeStorageCleanup} from "@/lib/admin/storage-cleanup";
const schema=z.discriminatedUnion("mode",[z.object({mode:z.literal("preview")}),z.object({mode:z.literal("execute"),fingerprint:z.string().length(64)})]);
export async function POST(request:NextRequest){try{const input=schema.parse(await request.json());const result=input.mode==="preview"?await createStorageCleanupPlan():await executeStorageCleanup(input.fingerprint);return NextResponse.json({result})}catch(error){const message=error instanceof Error?error.message:"Storage cleanup failed";return NextResponse.json({message},{status:message.includes("plan changed")?409:503})}}
