import "server-only";import type { DramaDraftInput } from "./drama-schema";import { repositoryMode } from "./supabase-config";import * as local from "./draft-repository";import * as remote from "./supabase-repository";
export const saveDramaDraft=(input:DramaDraftInput)=>repositoryMode()==="supabase"?remote.saveSupabaseDraft(input):local.saveDramaDraft(input);
export const listDramaDrafts=()=>repositoryMode()==="supabase"?remote.listSupabaseDrafts():local.listDramaDrafts();
export const publishDramaDraft=(id:string)=>repositoryMode()==="supabase"?remote.publishSupabaseDraft(id):local.publishDramaDraft(id);
export const getPublishedDramaDrafts=()=>repositoryMode()==="supabase"?remote.getSupabasePublished():local.getPublishedDramaDrafts();
export const getDramaForEdit=(id:string)=>repositoryMode()==="supabase"?remote.getSupabaseDramaForEdit(id):local.getDramaForEdit(id);
export const updateDrama=(id:string,input:import("./drama-schema").DramaUpdateInput)=>repositoryMode()==="supabase"?remote.updateSupabaseDrama(id,input):local.updateDrama(id,input);
export const deleteDrama=(id:string)=>repositoryMode()==="supabase"?remote.deleteSupabaseDrama(id):local.deleteDrama(id);
export async function listVizardSources(){
  const rows=await getPublishedDramaDrafts();
  return rows.map(row=>({id:row.id,title:row.title,slug:row.slug,language:row.language,coverUrl:row.coverUrl,episodes:row.episodes.map(episode=>({episodeNumber:episode.episodeNumber,videoUrl:episode.videoUrl}))}));
}
