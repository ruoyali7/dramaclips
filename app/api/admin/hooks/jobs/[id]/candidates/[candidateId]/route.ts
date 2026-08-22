import {NextResponse} from "next/server";
import {getHookJob} from "@/lib/admin/hook-job-repository";
import {deletePendingHookCandidate} from "@/lib/admin/hook-repository";

export async function DELETE(_request:Request,{params}:{params:Promise<{id:string;candidateId:string}>}){
  try{const {id,candidateId}=await params;const job=await getHookJob(id);if(!job)return NextResponse.json({message:"Hook job not found"},{status:404});const candidate=job.candidates.find(item=>item.id===candidateId);if(!candidate)return NextResponse.json({message:"Candidate not found"},{status:404});await deletePendingHookCandidate(job,candidate);return NextResponse.json({ok:true})}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not delete hook draft"},{status:409})}
}
