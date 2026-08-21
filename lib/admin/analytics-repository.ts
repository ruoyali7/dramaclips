import "server-only";
import { randomBytes } from "crypto";
import { getSupabaseConfig } from "./supabase-config";

type ShortLinkRow={id:string;code:string;drama_slug:string;source:string;account:string;campaign:string;clip:string;enabled:boolean;created_at:string};
export type TrackingEventInput={eventId?:string;name:string;sessionId:string;dramaId?:string;dramaSlug?:string;shortCode?:string;source:string;account:string;campaign:string;clip:string;device:string;metadata?:Record<string,unknown>};

async function request(path:string,init:RequestInit={}){const config=getSupabaseConfig();if(!config.configured)throw new Error("Supabase is not configured");const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});if(!response.ok)throw new Error(`Supabase ${response.status}: ${(await response.text()).slice(0,220)}`);if(response.status===204)return null;return response.json()}
function clean(value:string,fallback:string){return(value.trim()||fallback).slice(0,100).replace(/[^a-zA-Z0-9._-]/g,"_").toLowerCase()}
function safe(row:ShortLinkRow){return{id:row.id,code:row.code,dramaSlug:row.drama_slug,source:row.source,account:row.account,campaign:row.campaign,clip:row.clip,enabled:row.enabled,createdAt:row.created_at}}

export async function createShortLink(input:{dramaSlug:string;source:string;account?:string;campaign?:string;clip:string}){for(let attempt=0;attempt<5;attempt+=1){const code=randomBytes(5).toString("base64url").slice(0,6);try{const rows=await request("short_links",{method:"POST",headers:{Prefer:"return=representation"},body:JSON.stringify({code,drama_slug:clean(input.dramaSlug,"drama"),source:clean(input.source,"direct"),account:clean(input.account||"","main"),campaign:clean(input.campaign||"","organic"),clip:clean(input.clip,"clip")})}) as ShortLinkRow[];return safe(rows[0])}catch(error){if(!String(error).includes("23505"))throw error}}throw new Error("Could not allocate a unique short code")}
export async function getShortLink(code:string){const rows=await request(`short_links?code=eq.${encodeURIComponent(code)}&enabled=eq.true&select=*&limit=1`) as ShortLinkRow[];return rows[0]?safe(rows[0]):null}
export async function listShortLinks(){const rows=await request("short_links?select=*&order=created_at.desc&limit=100") as ShortLinkRow[];return rows.map(safe)}
export async function recordTrackingEvent(input:TrackingEventInput){await request("tracking_events",{method:"POST",headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({event_id:input.eventId,name:input.name,session_id:input.sessionId,drama_id:input.dramaId,drama_slug:input.dramaSlug,short_code:input.shortCode,source:input.source,account:input.account,campaign:input.campaign,clip:input.clip,device:input.device,metadata:input.metadata||{}})})}

export async function getAnalyticsSummary(){const since=new Date(Date.now()-30*24*60*60*1000).toISOString();return await request(`rpc/analytics_summary?since_at=${encodeURIComponent(since)}`) as {visits:number;sessions:number;previewStarts:number;previewCompletions:number;watchFullClicks:number;redirects:number;events:number;bySource:[string,number][];byDrama:[string,number][]}}
