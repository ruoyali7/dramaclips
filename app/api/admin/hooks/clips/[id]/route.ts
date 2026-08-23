import {NextResponse} from "next/server";
import {deleteHookClip} from "@/lib/admin/hook-repository";
export async function DELETE(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;return NextResponse.json({clip:await deleteHookClip(id)})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not delete hook"},{status:409})}}
