import {NextResponse} from "next/server";import {getRsImportJob} from "@/lib/admin/rs-import-jobs";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;const job=await getRsImportJob(id);return job?NextResponse.json({job}):NextResponse.json({message:"Import job not found"},{status:404})}
