import { NextResponse } from "next/server";
import { getDramaForEdit } from "@/lib/admin/repository";
import { queueDramaEpisodes } from "@/lib/admin/queue-drama-episodes";
import { dramaDraftSchema } from "@/lib/admin/drama-schema";
import { z, ZodError } from "zod";

export async function POST(request: Request, {params}: {params: Promise<{id: string}>}) {
  try {
    const input=z.object({episodeNumbers:z.array(z.number().int().positive()).min(1).max(100)}).parse(await request.json());
    const {id}=await params;
    const drama=await getDramaForEdit(id);
    if(!drama)return NextResponse.json({message:"Drama not found"},{status:404});
    const episodes=dramaDraftSchema.shape.episodes.safeParse(drama.episodes.filter(episode=>input.episodeNumbers.includes(episode.episodeNumber)));
    if(!episodes.success)return NextResponse.json({message:"Fix episode URLs before queueing"},{status:400});
    const vizard=await queueDramaEpisodes(drama,episodes.data);
    return NextResponse.json({vizard});
  } catch(error) { return NextResponse.json({message:"Could not queue episodes"},{status:error instanceof ZodError ? 400 : 503}); }
}
