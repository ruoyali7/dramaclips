import {NextResponse} from "next/server";
import {triggerRailwayWorker} from "@/lib/admin/railway-worker-trigger";
import {clearVizardSubmissionQueue,listVizardSubmissionJobs,listVizardProjects} from "@/lib/admin/vizard-repository";

export async function GET(){
  try{const [jobs,projects]=await Promise.all([listVizardSubmissionJobs(),listVizardProjects()]);return NextResponse.json({jobs,projects});}
  catch{return NextResponse.json({message:"Could not load Vizard queue"},{status:503});}
}

export async function POST(){
  const workerTrigger=await triggerRailwayWorker("vizard");
  if(workerTrigger.status==="disabled")return NextResponse.json({message:"Vizard worker trigger is not configured"},{status:503});
  if(workerTrigger.status==="failed")return NextResponse.json({message:workerTrigger.error},{status:503});
  return NextResponse.json({workerTrigger},{status:202});
}

export async function DELETE(){
  try{return NextResponse.json({cleared:await clearVizardSubmissionQueue()});}
  catch{return NextResponse.json({message:"Could not clear Vizard queue"},{status:503});}
}
