import "server-only";
import {getSupabaseConfig} from "./supabase-config";

export type InstagramStoryJob = {
  id:string;
  schedule_date:string;
  drama_slug:string;
  drama_title:string;
  image_url:string;
  content_code:string;
  target_url:string;
  selection_source:"daily_post"|"library"|"manual";
  status:"scheduled"|"publishing"|"published"|"failed"|"outcome_unknown";
  scheduled_at:string;
  reconnected_at?:string;
  started_at?:string;
  published_at?:string;
  story_result:Record<string,unknown>;
  error?:string;
  created_at:string;
  updated_at:string;
};

async function request(path:string,init:RequestInit={}){
  const config=getSupabaseConfig();
  if(!config.configured)throw new Error("Supabase is not configured");
  const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});
  if(!response.ok)throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,220)}`);
  if(response.status===204)return null;
  const text=await response.text();return text?JSON.parse(text):null;
}

export async function listInstagramStoryJobs(options:{scheduleDate?:string;status?:InstagramStoryJob["status"];dueBefore?:string;requireReconnect?:boolean;limit?:number}={}){
  const filters=[
    options.scheduleDate?`schedule_date=eq.${encodeURIComponent(options.scheduleDate)}`:"",
    options.status?`status=eq.${encodeURIComponent(options.status)}`:"",
    options.dueBefore?`scheduled_at=lte.${encodeURIComponent(options.dueBefore)}`:"",
    options.requireReconnect?"reconnected_at=not.is.null":"",
  ].filter(Boolean).map(filter=>`&${filter}`).join("");
  return await request(`instagram_story_jobs?select=*&order=scheduled_at.desc&limit=${options.limit||500}${filters}`) as InstagramStoryJob[];
}

export async function createInstagramStoryJobs(rows:Array<Omit<InstagramStoryJob,"id"|"status"|"story_result"|"created_at"|"updated_at">>){
  if(!rows.length)return [];
  return await request("instagram_story_jobs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(rows)}) as InstagramStoryJob[];
}

export async function updateInstagramStoryJobSchedule(id:string,scheduledAt:string,reconnectedAt:string){
  const rows=await request(`instagram_story_jobs?id=eq.${encodeURIComponent(id)}&status=eq.scheduled`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({scheduled_at:scheduledAt,reconnected_at:reconnectedAt,updated_at:reconnectedAt})}) as InstagramStoryJob[];
  return rows[0]||null;
}

export async function leaseInstagramStoryJob(workerId:string,leaseSeconds:number){
  const rows=await request("rpc/lease_instagram_story_job",{method:"POST",body:JSON.stringify({p_worker_id:workerId,p_lease_seconds:leaseSeconds})}) as InstagramStoryJob[];
  return rows[0]||null;
}

export type InstagramStoryConnectionStatus={sessionIdConfigured:boolean;settingsConfigured:boolean};

export type InstagramStoryReconnectAttempt={
  id:string;
  status:"requested"|"connecting"|"waiting_for_approval"|"connected"|"failed"|"expired";
  error?:string;
  requested_at:string;
  approval_confirmed_at?:string;
  connected_at?:string;
  expires_at:string;
  updated_at:string;
};

export async function getInstagramStoryConnectionStatus(){
  return await request("rpc/instagram_story_connection_status",{method:"POST",body:"{}"}) as InstagramStoryConnectionStatus;
}

export async function saveInstagramStorySessionId(sessionId:string){
  return await request("rpc/save_instagram_story_session_id",{method:"POST",body:JSON.stringify({p_session_id:sessionId})}) as string;
}

export async function getInstagramStoryReconnectAttempt(id:string){
  const rows=await request(`instagram_story_reconnect_attempts?id=eq.${encodeURIComponent(id)}&select=id,status,error,requested_at,approval_confirmed_at,connected_at,expires_at,updated_at&limit=1`) as InstagramStoryReconnectAttempt[];
  return rows[0]||null;
}

export async function getActiveInstagramStoryReconnectAttempt(){
  const now=encodeURIComponent(new Date().toISOString());
  const rows=await request(`instagram_story_reconnect_attempts?status=in.(requested,connecting,waiting_for_approval)&expires_at=gt.${now}&select=id,status,error,requested_at,approval_confirmed_at,connected_at,expires_at,updated_at&order=requested_at.desc&limit=1`) as InstagramStoryReconnectAttempt[];
  return rows[0]||null;
}

export async function createInstagramStoryReconnectAttempt(){
  const rows=await request("instagram_story_reconnect_attempts",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({})}) as InstagramStoryReconnectAttempt[];
  if(!rows[0])throw new Error("Instagram reconnect attempt was not created");
  return rows[0];
}

export async function confirmInstagramStoryReconnectApproval(id:string){
  const rows=await request(`instagram_story_reconnect_attempts?id=eq.${encodeURIComponent(id)}&status=eq.waiting_for_approval`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({approval_confirmed_at:new Date().toISOString(),updated_at:new Date().toISOString()})}) as InstagramStoryReconnectAttempt[];
  return rows[0]||null;
}

export async function failInstagramStoryReconnectAttempt(id:string,error:string){
  const rows=await request(`instagram_story_reconnect_attempts?id=eq.${encodeURIComponent(id)}&status=eq.requested`,{method:"PATCH",headers:{Prefer:"return=representation"},body:JSON.stringify({status:"failed",error,updated_at:new Date().toISOString()})}) as InstagramStoryReconnectAttempt[];
  return rows[0]||null;
}
