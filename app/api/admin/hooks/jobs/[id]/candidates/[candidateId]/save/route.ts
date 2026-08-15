import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {getHookJob} from "@/lib/admin/hook-job-repository";
import {approveHookCandidate} from "@/lib/admin/hook-repository";

const schema=z.object({title:z.string().trim().min(1).max(120)});
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string;candidateId:string}>}){
  try{const {id,candidateId}=await params;const {title}=schema.parse(await request.json());const job=await getHookJob(id);if(!job)throw new Error("Hook job not found");const candidate=job.candidates.find(item=>item.id===candidateId);if(!candidate)throw new Error("Candidate not found");return NextResponse.json({clip:await approveHookCandidate(job,candidate,title)});}catch(error){return NextResponse.json({message:error instanceof Error?error.message:"Could not save hook"},{status:409})}
}
