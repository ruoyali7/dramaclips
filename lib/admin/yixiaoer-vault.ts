import "server-only";
import {getSupabaseConfig} from "./supabase-config";

export async function saveYixiaoerWorkerApiKey(apiKey:string){
  const config=getSupabaseConfig();
  if(!config.configured)throw new Error("Supabase is required for the Yixiaoer worker credential");
  const response=await fetch(`${config.url}/rest/v1/rpc/set_yixiaoer_worker_api_key`,{
    method:"POST",
    headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json"},
    body:JSON.stringify({p_api_key:apiKey}),
    cache:"no-store",
  });
  if(!response.ok)throw new Error(`Could not update the Yixiaoer worker credential (${response.status})`);
  return{updatedAt:String(await response.json())};
}
