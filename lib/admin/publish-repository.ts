import "server-only";
import { getSupabaseConfig } from "./supabase-config";
import { createShortLink } from "./analytics-repository";

export const publishingPlatforms=["tiktok","instagram","youtube","facebook","x"] as const;
export type PublishingPlatform=typeof publishingPlatforms[number];
type PlatformPack={source:PublishingPlatform;shortCode:string;url:string;hook:string;caption:string};
type Row={id:string;drama_slug:string;episode_number:number;video_url:string;account:string;campaign:string;scheduled_at?:string;status:string;platforms:PlatformPack[];metricool_post_ids:Record<string,string>;created_at:string;updated_at:string};

async function request(path:string,init:RequestInit={}){const config=getSupabaseConfig();if(!config.configured)throw new Error("Supabase is not configured");const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});if(!response.ok)throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,220)}`);return response.status===204?null:response.json()}
function safe(row:Row){return{id:row.id,dramaSlug:row.drama_slug,episodeNumber:row.episode_number,videoUrl:row.video_url,account:row.account,campaign:row.campaign,scheduledAt:row.scheduled_at,status:row.status,platforms:row.platforms,metricoolPostIds:row.metricool_post_ids,createdAt:row.created_at}}
function copyFor(source:PublishingPlatform,title:string,episode:number,url:string){const hooks:Record<PublishingPlatform,string>={tiktok:"Wait—did that really just happen?",instagram:"The moment everything changed…",youtube:"You won't expect what happens next",facebook:"One decision changed the entire story.",x:"This scene changes everything."};const hook=hooks[source];const base=`${hook}\n${title} · EP ${episode}\nWatch free episodes: ${url}`;const suffix=source==="x"?" #ShortDrama":source==="youtube"?"\n#Shorts #Drama":"\n#ShortDrama #DramaClips";return{hook,caption:`${base}${suffix}`}}

export async function createPublishPackage(input:{dramaSlug:string;title:string;episodeNumber:number;videoUrl:string;account?:string;campaign?:string;scheduledAt?:string;platforms:PublishingPlatform[];siteUrl:string}){
  await request("publish_packages?select=id&limit=0");
  const packs:PlatformPack[]=[];
  for(const source of input.platforms){const link=await createShortLink({dramaSlug:input.dramaSlug,source,account:input.account,campaign:input.campaign,clip:`ep-${String(input.episodeNumber).padStart(2,"0")}`});const url=`${input.siteUrl.replace(/\/$/,"")}/x/${link.code}`;packs.push({source,shortCode:link.code,url,...copyFor(source,input.title,input.episodeNumber,url)})}
  const rows=await request("publish_packages",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({drama_slug:input.dramaSlug,episode_number:input.episodeNumber,video_url:input.videoUrl,account:input.account||"main",campaign:input.campaign||"organic",scheduled_at:input.scheduledAt||null,status:"ready",platforms:packs})}) as Row[];
  return safe(rows[0]);
}
export async function listPublishPackages(){const rows=await request("publish_packages?select=*&order=created_at.desc&limit=50") as Row[];return rows.map(safe)}
