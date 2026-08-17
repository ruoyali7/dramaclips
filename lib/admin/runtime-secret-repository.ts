import "server-only";
import {decryptSensitive,encryptSensitive} from "./encryption";
import {getSupabaseConfig} from "./supabase-config";

type SecretRow={name:string;encrypted_value:string;updated_at:string};
async function request(path:string,init:RequestInit={}){const config=getSupabaseConfig();if(!config.configured)throw new Error("Supabase is required for runtime secrets");const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});if(!response.ok)throw new Error(`Runtime secret store failed (${response.status})`);return response.status===204?null:response.json()}
export async function getRuntimeSecret(name:string){const rows=await request(`admin_runtime_secrets?name=eq.${encodeURIComponent(name)}&select=*&limit=1`) as SecretRow[];return rows[0]?{value:decryptSensitive(rows[0].encrypted_value),updatedAt:rows[0].updated_at}:null}
export async function hasRuntimeSecret(name:string){const rows=await request(`admin_runtime_secrets?name=eq.${encodeURIComponent(name)}&select=name,updated_at&limit=1`) as Pick<SecretRow,"name"|"updated_at">[];return rows[0]?{configured:true,updatedAt:rows[0].updated_at}:{configured:false,updatedAt:null}}
export async function saveRuntimeSecret(name:string,value:string){const rows=await request("admin_runtime_secrets?on_conflict=name",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=representation"},body:JSON.stringify({name,encrypted_value:encryptSensitive(value),updated_at:new Date().toISOString()})}) as SecretRow[];return{configured:true,updatedAt:rows[0].updated_at}}
