import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { enqueueVizardSubmissions } from "@/lib/admin/vizard-repository";

const item = z.object({ dramaId:z.string().min(1), dramaSlug:z.string().min(1), episodeNumber:z.number().int().positive(), projectName:z.string().trim().min(2).max(140), videoUrl:z.string().url().refine((v)=>new URL(v).protocol==="https:"), settings:z.record(z.string(),z.unknown()) });
const schema = z.object({ jobs:z.array(item).min(1).max(100) });
export async function POST(request: NextRequest) {
  try { const { jobs } = schema.parse(await request.json()); return NextResponse.json({ jobs: await enqueueVizardSubmissions(jobs), status:"queued" }, { status:202 }); }
  catch (error) { if (error instanceof ZodError) return NextResponse.json({message:"Check the Vizard batch settings"},{status:400}); return NextResponse.json({message:error instanceof Error?error.message:"Could not queue Vizard jobs"},{status:503}); }
}
