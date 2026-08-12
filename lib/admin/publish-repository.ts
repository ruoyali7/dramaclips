import "server-only";
import { getSupabaseConfig } from "./supabase-config";
import { createShortLink } from "./analytics-repository";

export const publishingPlatforms=["tiktok","instagram","youtube","facebook","x"] as const;
export type PublishingPlatform=typeof publishingPlatforms[number];
type PlatformPack={source:PublishingPlatform;shortCode:string;url:string;hook:string;caption:string};
type Row={id:string;drama_slug:string;episode_number:number;video_url:string;account:string;campaign:string;scheduled_at?:string;status:string;platforms:PlatformPack[];metricool_post_ids:Record<string,string>;created_at:string;updated_at:string};

async function request(path:string,init:RequestInit={}){const config=getSupabaseConfig();if(!config.configured)throw new Error("Supabase is not configured");const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});if(!response.ok)throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,220)}`);return response.status===204?null:response.json()}
function safe(row:Row){return{id:row.id,dramaSlug:row.drama_slug,episodeNumber:row.episode_number,videoUrl:row.video_url,account:row.account,campaign:row.campaign,scheduledAt:row.scheduled_at,status:row.status,platforms:row.platforms,metricoolPostIds:row.metricool_post_ids,createdAt:row.created_at}}
function shorten(value:string,max:number){const clean=value.replace(/\s+/g," ").trim();if(clean.length<=max)return clean;return `${clean.slice(0,max-1).replace(/[,;:\s]+$/g,"")}…`}
function hashTag(value:string){return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"").slice(0,28)}
function copyFor(source:PublishingPlatform,title:string,episode:number,url:string,promoCode:string,description:string,tags:string[]){
  const firstSentence=description.match(/^.+?[.!?](?:\s|$)/)?.[0]||description;
  const hookLead:Record<PublishingPlatform,string>={tiktok:"😱 Wait—this changes everything:",instagram:"✨ The moment everything changed:",youtube:"👀 You won't expect what happens next:",facebook:"💔 One decision changed the entire story:",x:"😳 This scene changes everything:"};
  const hook=`${hookLead[source]} ${shorten(firstSentence,source==="x"?65:150)}`;
  const titleTag=hashTag(title);const tagSet=["#ReelShort","#DramaClips","#ShortDrama",...(source==="youtube"?["#Shorts"]:[]),...(titleTag?[`#${titleTag}`]:[]),...tags.slice(0,2).map(tag=>`#${hashTag(tag)}`).filter(tag=>tag!=="#")];
  const top=`🔥 Watch now 👉 ${url}`;
  const code=`🔍 Search “${promoCode}” in ReelShort or DramaClips`;
  if(source==="x"){
    const fixed=`${top}\n${hook}\n${code}\n#ReelShort #ShortDrama`;
    return{hook,caption:shorten(fixed,280)};
  }
  const descriptionLimit:Record<Exclude<PublishingPlatform,"x">,number>={tiktok:420,instagram:700,youtube:900,facebook:1000};
  const story=shorten(description,descriptionLimit[source]);
  const caption=[top,"🌟 Continue the story here",hook,`🎬 ${title} · EP ${episode}`,"👉🏻 📲 Download the ReelShort app",code,`✨ ${story}`,tagSet.join(" ")].join("\n");
  return{hook,caption};
}

export async function createPublishPackage(input:{dramaSlug:string;title:string;promoCode:string;description:string;tags:string[];episodeNumber:number;videoUrl:string;account?:string;campaign?:string;scheduledAt?:string;platforms:PublishingPlatform[];siteUrl:string}){
  await request("publish_packages?select=id&limit=0");
  const packs:PlatformPack[]=[];
  for(const source of input.platforms){const link=await createShortLink({dramaSlug:input.dramaSlug,source,account:input.account,campaign:input.campaign,clip:`ep-${String(input.episodeNumber).padStart(2,"0")}`});const url=`${input.siteUrl.replace(/\/$/,"")}/x/${link.code}`;packs.push({source,shortCode:link.code,url,...copyFor(source,input.title,input.episodeNumber,url,input.promoCode,input.description,input.tags)})}
  const rows=await request("publish_packages",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({drama_slug:input.dramaSlug,episode_number:input.episodeNumber,video_url:input.videoUrl,account:input.account||"main",campaign:input.campaign||"organic",scheduled_at:input.scheduledAt||null,status:"ready",platforms:packs})}) as Row[];
  return safe(rows[0]);
}
export async function listPublishPackages(){const rows=await request("publish_packages?select=*&order=created_at.desc&limit=50") as Row[];return rows.map(safe)}
