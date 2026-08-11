import "server-only";
import { mkdir,readFile,rename,writeFile } from "fs/promises";import path from "path";import { randomUUID } from "crypto";import type { DramaDraftInput } from "./drama-schema";import { encryptSensitive } from "./encryption";
function filePath(){return process.env.DRAMA_DRAFT_FILE||path.join(process.cwd(),"data","drama-drafts.json")}
export type StoredDramaDraft=Omit<DramaDraftInput,"cpsUrl">&{id:string;status:"draft"|"published";createdAt:string;publishedAt?:string;cpsUrlEncrypted:string};
async function readRows():Promise<StoredDramaDraft[]>{try{const parsed=JSON.parse(await readFile(filePath(),"utf8"));return Array.isArray(parsed)?parsed:[]}catch{return[]}}
async function writeRows(rows:StoredDramaDraft[]){const file=filePath();await mkdir(path.dirname(file),{recursive:true});const temp=`${file}.tmp`;await writeFile(temp,JSON.stringify(rows,null,2),{mode:0o600});await rename(temp,file)}
export async function saveDramaDraft(input:DramaDraftInput){const rows=await readRows();if(rows.some(row=>row.slug===input.slug||row.publicCode===input.publicCode))throw new Error("A drama with this slug or code already exists");const {cpsUrl,...publicInput}=input;const record:StoredDramaDraft={id:randomUUID(),status:"draft",createdAt:new Date().toISOString(),...publicInput,cpsUrlEncrypted:encryptSensitive(cpsUrl)};await writeRows([...rows,record]);return sanitize(record)}
export async function listDramaDrafts(){return(await readRows()).map(sanitize)}
export async function publishDramaDraft(id:string){const rows=await readRows();const target=rows.find(row=>row.id===id);if(!target)throw new Error("Draft not found");target.status="published";target.publishedAt=new Date().toISOString();await writeRows(rows);return sanitize(target)}
export async function getPublishedDramaDrafts(){return(await readRows()).filter(row=>row.status==="published")}
function sanitize(record:StoredDramaDraft){return{id:record.id,status:record.status,title:record.title,slug:record.slug,publicCode:record.publicCode,promoCode:record.promoCode,episodeCount:record.episodes.length,destinationHost:"reelslink.com",createdAt:record.createdAt,publishedAt:record.publishedAt}}
