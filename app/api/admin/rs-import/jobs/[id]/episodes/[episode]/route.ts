import {NextResponse} from "next/server";import {processRsEpisode} from "@/lib/admin/rs-import-jobs";
export const maxDuration=300;
export async function POST(_:Request,{params}:{params:Promise<{id:string;episode:string}>}){try{const {id,episode}=await params;return NextResponse.json({job:await processRsEpisode(id,Number(episode))})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Episode transfer failed"},{status:502})}}
