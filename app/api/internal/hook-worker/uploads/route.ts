import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getHookJob } from "@/lib/admin/hook-job-repository";
import { createR2Upload } from "@/lib/admin/r2";

const schema = z.object({
  jobId: z.string().uuid(),
  workerId: z.string().min(3),
  rank: z.number().int().min(1).max(6),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(1024 * 1024 * 1024),
});
function authorized(request: NextRequest) {
  const token = process.env.HOOK_WORKER_TOKEN;
  return Boolean(
    token &&
    (request.headers.get("x-hook-worker-token") === token ||
      request.headers.get("authorization") === `Bearer ${token}`),
  );
}

export async function POST(request: NextRequest) {
  if (!authorized(request))
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    const job = await getHookJob(input.jobId);
    if (!job || job.leaseOwner !== input.workerId)
      throw new Error("Worker does not own this job lease");
    const upload = createR2Upload({
      fileName: `hook-${input.rank}.mp4`,
      contentType: "video/mp4",
      size: input.sizeBytes,
      slug: job.dramaSlug,
      kind: "hook-draft",
    });
    return NextResponse.json(upload);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not prepare upload",
      },
      { status: 409 },
    );
  }
}
