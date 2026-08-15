import "server-only";
import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSupabaseConfig } from "./supabase-config";
import {promoteHookDraft} from "./r2";
import type {HookCandidate,HookJob} from "./hook-job-types";

export type HookClip = { id:string; dramaSlug:string; title:string; sourceEpisodes:number[]; videoUrl:string; durationSeconds:number; status:"saved"; createdAt:string };
type Row={id:string;drama_slug:string;title:string;source_episodes:number[];video_url:string;duration_seconds:number;status:"saved";created_at:string};
function localPath(){return process.env.HOOK_CLIP_FILE||path.join(process.cwd(),"data","hook-clips.json")}
function fromRow(row:Row):HookClip{return{id:row.id,dramaSlug:row.drama_slug,title:row.title,sourceEpisodes:row.source_episodes,videoUrl:row.video_url,durationSeconds:Number(row.duration_seconds),status:row.status,createdAt:row.created_at}}
async function localRows():Promise<HookClip[]>{try{const rows=JSON.parse(await readFile(localPath(),"utf8"));return Array.isArray(rows)?rows:[]}catch{return[]}}
async function writeLocal(rows:HookClip[]){const file=localPath();await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.tmp`;await writeFile(temp,JSON.stringify(rows,null,2),{mode:0o600});await rename(temp,file)}
async function request(pathname:string,init:RequestInit={}){const config=getSupabaseConfig();const response=await fetch(`${config.url}/rest/v1/${pathname}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});if(!response.ok)throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,180)}`);return response.status===204?null:response.json()}
export async function listHookClips(dramaSlug?:string){const config=getSupabaseConfig();if(!config.configured){const rows=await localRows();return rows.filter(row=>!dramaSlug||row.dramaSlug===dramaSlug).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))}const filter=dramaSlug?`&drama_slug=eq.${encodeURIComponent(dramaSlug)}`:"";const rows=await request(`hook_clips?select=*&status=eq.saved${filter}&order=created_at.desc`) as Row[];return rows.map(fromRow)}
export async function saveHookClip(input:Omit<HookClip,"id"|"status"|"createdAt">){const config=getSupabaseConfig();if(!config.configured){const row:HookClip={...input,id:randomUUID(),status:"saved",createdAt:new Date().toISOString()};await writeLocal([row,...await localRows()]);return row}const rows=await request("hook_clips",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({drama_slug:input.dramaSlug,title:input.title,source_episodes:input.sourceEpisodes,video_url:input.videoUrl,duration_seconds:input.durationSeconds,status:"saved"})}) as Row[];return fromRow(rows[0])}

export async function approveHookCandidate(job:HookJob,candidate:HookCandidate,title:string){
  if(!candidate.draftObjectKey||!candidate.draftUrl||!candidate.durationSeconds)throw new Error("Candidate has no rendered draft");
  const config=getSupabaseConfig();if(config.configured){const existing=await request(`hook_clips?candidate_id=eq.${encodeURIComponent(candidate.id)}&select=*`) as Row[];if(existing[0])return fromRow(existing[0])}
  const promoted=await promoteHookDraft({sourceKey:candidate.draftObjectKey,slug:job.dramaSlug,fileName:`${title}.mp4`,stableId:candidate.id});
  if(!config.configured)return saveHookClip({dramaSlug:job.dramaSlug,title,sourceEpisodes:job.sourceEpisodes,videoUrl:promoted.publicUrl,durationSeconds:candidate.durationSeconds});
  const payload={job_id:job.id,candidate_id:candidate.id,drama_id:job.dramaId,drama_slug:job.dramaSlug,title,hook_type:candidate.hookType,source_episodes:job.sourceEpisodes,source_ranges:candidate.sourceRanges,rendered_ranges:candidate.renderedRanges,object_key:promoted.objectKey,video_url:promoted.publicUrl,duration_seconds:candidate.durationSeconds,width:candidate.width||1080,height:candidate.height||1920,video_codec:candidate.videoCodec||"h264",audio_codec:candidate.audioCodec||"aac",size_bytes:candidate.sizeBytes||null,score:candidate.score,score_components:candidate.scoreComponents,rationale:candidate.rationale,risk_level:candidate.riskLevel,cover_source_timestamp:candidate.coverSourceTimestamp,transcript_version:"faster-whisper-1.2",ranking_version:"grounded-v2",render_version:"ffmpeg-v2",review_state:"approved",reviewed_by:"admin",reviewed_at:new Date().toISOString(),status:"saved"};
  const rows=await request("hook_clips",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(payload)}) as Row[];
  await request(`hook_candidates?id=eq.${encodeURIComponent(candidate.id)}`,{method:"PATCH",body:JSON.stringify({review_state:"approved",reviewed_by:"admin",reviewed_at:new Date().toISOString()})});return fromRow(rows[0]);
}
