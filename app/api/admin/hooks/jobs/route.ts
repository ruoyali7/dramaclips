import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import {
  createHookJob,
  getHookJob,
  listHookJobs,
} from "@/lib/admin/hook-job-repository";
import { listVizardSources } from "@/lib/admin/repository";
const schema = z.object({
  dramaId: z.string().uuid(),
  episodeNumbers: z.array(z.number().int().positive()).min(1).max(15),
  forceNew: z.boolean().default(false),
  settings: z
    .object({
      maxHooks: z.number().int().min(1).max(6).default(6),
      coverDuration: z.number().min(0.1).max(0.3).default(0.1),
      hookTitle: z.boolean().default(false),
      creativeDirection: z.string().trim().max(1200).default(""),
    })
    .default({
      maxHooks: 6,
      coverDuration: 0.1,
      hookTitle: false,
      creativeDirection: "",
    }),
});
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id) {
    const job = await getHookJob(id);
    return job
      ? NextResponse.json({ job })
      : NextResponse.json({ message: "Job not found" }, { status: 404 });
  }
  const dramaId = request.nextUrl.searchParams.get("dramaId") || undefined;
  const jobs = await listHookJobs(dramaId, 10);
  return NextResponse.json({ jobs });
}
export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const source = (await listVizardSources()).find(
      (item) => item.id === input.dramaId,
    );
    if (!source)
      return NextResponse.json({ message: "Drama not found" }, { status: 404 });
    const wanted = new Set(input.episodeNumbers);
    const sourceAssets = source.episodes.filter((item) =>
      wanted.has(item.episodeNumber),
    );
    if (sourceAssets.length !== wanted.size)
      return NextResponse.json(
        { message: "Invalid drama episode selection" },
        { status: 400 },
      );
    const job = await createHookJob({
      dramaId: source.id,
      dramaSlug: source.slug,
      sourceAssets,
      settings: {
        ...input.settings,
        contentCode: source.promoCode || source.publicCode,
        coverUrl: source.coverUrl,
      },
      forceNew: input.forceNew,
    });
    return NextResponse.json({ job }, { status: 202 });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          message:
            "Select one to fifteen episodes and generate up to six hooks",
        },
        { status: 400 },
      );
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Could not create hook job",
      },
      { status: 503 },
    );
  }
}
