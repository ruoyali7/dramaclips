import {NextRequest,NextResponse} from "next/server";import {listHookClips} from "@/lib/admin/hook-repository";
export async function GET(request:NextRequest){try{return NextResponse.json({hooks:await listHookClips(request.nextUrl.searchParams.get("slug")||undefined)})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not load hooks"},{status:503})}}
export async function POST(){return NextResponse.json({message:"Legacy draft save is disabled. Approve and save a durable hook candidate through its job."},{status:410})}
