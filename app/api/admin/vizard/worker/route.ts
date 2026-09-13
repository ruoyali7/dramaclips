import {NextResponse} from "next/server";
import {triggerRailwayWorker} from "@/lib/admin/railway-worker-trigger";
import {listVizardSubmissionJobs,listVizardProjects} from "@/lib/admin/vizard-repository";

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
