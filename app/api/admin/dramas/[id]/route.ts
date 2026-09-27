import { NextRequest,NextResponse } from "next/server";
import { ZodError } from "zod";
import { dramaUpdateSchema } from "@/lib/admin/drama-schema";
import { deleteDrama,updateDrama,getDramaForEdit } from "@/lib/admin/repository";
import { queueDramaEpisodes } from "@/lib/admin/queue-drama-episodes";

export async function PATCH(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
  try {
    const {id}=await params;
    const body=await request.json();
    const queueVizard=body.queueVizard===true;
    const input=dramaUpdateSchema.parse(body);
    const previous=await getDramaForEdit(id);
    if(!previous)return NextResponse.json({message:"Drama not found"},{status:404});
    const added=input.episodes.filter(episode=>!previous.episodes.some(old=>old.episodeNumber===episode.episodeNumber));
    const changed=input.episodes.filter(episode=>previous.episodes.some(old=>old.episodeNumber===episode.episodeNumber&&old.videoUrl!==episode.videoUrl));
    const draft=await updateDrama(id,input);
    const vizard=queueVizard
      ? await queueDramaEpisodes({...draft,language:input.language},added)
      : {status:"skipped" as const,requested:added.length,accepted:0};
    return NextResponse.json({draft,vizard,queueEpisodeNumbers:added.map(episode=>episode.episodeNumber),changedEpisodes:changed.map(episode=>episode.episodeNumber)});
  }catch(error){
    if(error instanceof ZodError)return NextResponse.json({message:"Check the highlighted fields",fieldErrors:error.flatten().fieldErrors},{status:400});
    return NextResponse.json({message:"Could not update drama. Please retry."},{status:500});
  }
}
export async function DELETE(_:NextRequest,{params}:{params:Promise<{id:string}>}){try{const {id}=await params;await deleteDrama(id);return new NextResponse(null,{status:204})}catch{return NextResponse.json({message:"Drama could not be deleted"},{status:404})}}
