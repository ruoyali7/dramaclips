import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {runStorageCleanup} from "@/lib/admin/storage-cleanup";
const schema=z.object({confirm:z.literal(true)});
export async function POST(request:NextRequest){try{schema.parse(await request.json());return NextResponse.json({result:await runStorageCleanup()})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Storage cleanup failed"},{status:503})}}
