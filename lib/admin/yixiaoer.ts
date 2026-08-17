import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { PublishingPlatform } from "./publish-repository";
import {getRuntimeSecret} from "./runtime-secret-repository";
import {createHash} from "node:crypto";

const execFileAsync=promisify(execFile);
const configuredKeys=new Map<string,Promise<void>>();
const platformNames:Partial<Record<PublishingPlatform,string>>={tiktok:"TikTok",instagram:"Instagram",youtube:"Youtube",facebook:"Facebook"};
export const yixiaoerPlatforms=Object.keys(platformNames) as PublishingPlatform[];
export type YixiaoerAccount={id:string;name:string;platform:string;status:number;avatar?:string};
type JsonEnvelope={ok:boolean;data?:unknown;error?:{message?:string;hint?:string;code?:string}};
type PublishPack={source:PublishingPlatform;caption:string};

async function activeApiKey(){try{return(await getRuntimeSecret("yixiaoer_api_key"))?.value||process.env.YIXIAOER_API_KEY||""}catch{return process.env.YIXIAOER_API_KEY||""}}
export async function yixiaoerConfigured(){return Boolean(await activeApiKey())}
export function yixiaoerPlatformName(platform:PublishingPlatform){const name=platformNames[platform];if(!name)throw new Error(`${platform} is not supported by Yixiaoer video publishing`);return name}
function binary(){return process.env.YXER_BIN||join(process.cwd(),"node_modules",".bin","yxer")}
function keyId(key:string){return createHash("sha256").update(key).digest("hex").slice(0,16)}
function env(key:string){return{...process.env,YIXIAOER_API_KEY:key,YIXIAOER_CONFIG:join(tmpdir(),`dramaclips-yxer-${keyId(key)}.json`)}}
async function ensureConfig(key:string){const id=keyId(key);let ready=configuredKeys.get(id);if(!ready){ready=(async()=>{try{await execFileAsync(binary(),["config","set-api-key",key],{env:env(key),maxBuffer:1024*1024,timeout:30000});if(process.env.YIXIAOER_CLIENT_ID)await execFileAsync(binary(),["config","set-local-client-id",process.env.YIXIAOER_CLIENT_ID],{env:env(key),maxBuffer:1024*1024,timeout:30000})}catch{throw new Error("Could not initialize Yixiaoer CLI configuration")}})();configuredKeys.set(id,ready)}try{await ready}catch(error){configuredKeys.delete(id);throw error}}
function safeError(value:unknown){if(value&&typeof value==="object"){const e=value as JsonEnvelope;return [e.error?.message,e.error?.hint].filter(Boolean).join(" · ")||"Yixiaoer command failed"}return"Yixiaoer command failed"}
async function runYxerWithKey(args:string[],key:string){
  if(!key)throw new Error("YIXIAOER_API_KEY is not configured");
  await ensureConfig(key);
  try{const {stdout}=await execFileAsync(binary(),args,{env:env(key),maxBuffer:8*1024*1024,timeout:120000});const parsed=JSON.parse(stdout) as JsonEnvelope;if(!parsed.ok)throw new Error(safeError(parsed));return parsed.data}
  catch(error){const reason=error as Error&{stdout?:string;stderr?:string};if(reason.stdout)try{throw new Error(safeError(JSON.parse(reason.stdout)))}catch(parsed){if(parsed instanceof Error&&parsed!==reason)throw parsed}throw new Error(reason.message||"Yixiaoer command failed")}
}
export async function runYxer(args:string[]){return runYxerWithKey(args,await activeApiKey())}
function accountRows(data:unknown):Record<string,unknown>[] {if(Array.isArray(data))return data as Record<string,unknown>[];if(data&&typeof data==="object"){const row=data as Record<string,unknown>;for(const key of ["items","list","records","accounts"]){if(Array.isArray(row[key]))return row[key] as Record<string,unknown>[]}}return[]}
export async function listYixiaoerAccounts(platform?:PublishingPlatform){const args=["accounts","list",...(platform?[yixiaoerPlatformName(platform)]:[]),"--status","1","--all","--json"];return accountRows(await runYxer(args)).map(row=>({id:String(row.id||row.platformAccountId||""),name:String(row.platformAccountName||row.name||row.nickname||"Account"),platform:String(row.platformName||platformNames[platform||"tiktok"]||""),status:Number(row.status??row.loginStatus??0),avatar:typeof row.platformAvatar==="string"?row.platformAvatar:undefined})).filter(row=>row.id&&row.status===1)}
export async function validateYixiaoerApiKey(key:string){const data=await runYxerWithKey(["accounts","list","--status","1","--all","--json"],key);return accountRows(data).map(row=>({id:String(row.id||row.platformAccountId||""),name:String(row.platformAccountName||row.name||row.nickname||"Account"),platform:String(row.platformName||""),status:Number(row.status??row.loginStatus??0)})).filter(row=>row.id&&row.status===1)}
function uploadObject(data:unknown){if(!data||typeof data!=="object")throw new Error("Yixiaoer upload returned no resource");const row=data as Record<string,unknown>;const candidate=(row.resource||row.file||row.upload||row) as Record<string,unknown>;if(!candidate.key)throw new Error("Yixiaoer upload returned no resource key");return candidate}
export async function uploadYixiaoerVideo(url:string){return uploadObject(await runYxer(["upload","--url",url,"--bucket","cloud-publish","--json"]))}
function clip(value:string,max:number){return value.length<=max?value:value.slice(0,max-1)+"…"}
export function buildYixiaoerPayload(platform:PublishingPlatform,accountId:string,video:Record<string,unknown>,pack:PublishPack,title:string){const name=yixiaoerPlatformName(platform);const content:Record<string,unknown>={formType:"task"};if(platform==="youtube")Object.assign(content,{title:clip(title,100),description:clip(pack.caption,5000),tags:["Shorts","DramaClips","ShortDrama"],category:"22",license:"youtube",embeddable:true,madeForKids:false,visible:"public",containsSyntheticMedia:false,fps:10});if(platform==="tiktok")Object.assign(content,{description:clip(pack.caption,2200),visible:"public",comment:true,stitch:true,duet:true,aigc:false,business:false,yourOwn:false,collaborative:false,fps:10,isAdVideo:false});if(platform==="facebook")Object.assign(content,{title:clip(title,128),description:clip(pack.caption,2048)});if(platform==="instagram")Object.assign(content,{description:clip(pack.caption,2200),share_to_feed:true});return{action:"publish",publishType:"video",platforms:[name],publishChannel:process.env.YIXIAOER_PUBLISH_CHANNEL||"cloud",desc:title,publishArgs:{video,accountForms:[{platformAccountId:accountId,platformName:name,video,contentPublishForm:content}]}}}
async function withPayload<T>(payload:unknown,fn:(path:string)=>Promise<T>){const dir=await mkdtemp(join(tmpdir(),"dramaclips-yxer-"));const path=join(dir,"payload.json");try{await writeFile(path,JSON.stringify(payload),{encoding:"utf8",mode:0o600});return await fn(path)}finally{await rm(dir,{recursive:true,force:true})}}
function channelArgs(){const channel=process.env.YIXIAOER_PUBLISH_CHANNEL||"cloud";return["--publish-channel",channel,...(channel==="local"?["--client-id",process.env.YIXIAOER_CLIENT_ID||""]:[])]}
export async function validateYixiaoerPayload(platform:PublishingPlatform,payload:unknown){const name=yixiaoerPlatformName(platform);return withPayload(payload,async path=>{const validation=await runYxer(["validate",name,"video",path,...channelArgs(),"--json"]);const preview=await runYxer(["publish","video",name,path,...channelArgs(),"--dry-run","--json"]);return{validation,preview}})}
export async function publishYixiaoerPayload(platform:PublishingPlatform,payload:unknown){const name=yixiaoerPlatformName(platform);return withPayload(payload,path=>runYxer(["publish","video",name,path,...channelArgs(),"--json"]))}
