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

export async function listInstagramStoryJobs(options:{scheduleDate?:string;limit?:number}={}){
  const filters=options.scheduleDate?`&schedule_date=eq.${encodeURIComponent(options.scheduleDate)}`:"";
  return await request(`instagram_story_jobs?select=*&order=scheduled_at.desc&limit=${options.limit||500}${filters}`) as InstagramStoryJob[];
}

export async function createInstagramStoryJobs(rows:Array<Omit<InstagramStoryJob,"id"|"status"|"story_result"|"created_at"|"updated_at">>){
  if(!rows.length)return [];
  return await request("instagram_story_jobs",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify(rows)}) as InstagramStoryJob[];
}

export async function leaseInstagramStoryJob(workerId:string,leaseSeconds:number){
  const rows=await request("rpc/lease_instagram_story_job",{method:"POST",body:JSON.stringify({p_worker_id:workerId,p_lease_seconds:leaseSeconds})}) as InstagramStoryJob[];
  return rows[0]||null;
}
