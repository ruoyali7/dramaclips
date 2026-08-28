import "server-only";
import {getSupabaseConfig} from "./supabase-config";
import type {YixiaoerAccount} from "./yixiaoer";

type CacheRow={accounts:YixiaoerAccount[];synced_at:string};

async function request(path:string,init:RequestInit={}){
  const config=getSupabaseConfig();
  if(!config.configured)throw new Error("Supabase is required for Yixiaoer account cache");
  const response=await fetch(`${config.url}/rest/v1/${path}`,{...init,headers:{apikey:config.key,Authorization:`Bearer ${config.key}`,"Content-Type":"application/json",...init.headers},cache:"no-store"});
  if(!response.ok)throw new Error(`Yixiaoer account cache failed (${response.status})`);
  const body=await response.text();
  return body?JSON.parse(body):null;
}

export async function getCachedYixiaoerAccounts(){
  const rows=await request("yixiaoer_account_cache?id=eq.active&select=accounts,synced_at&limit=1") as CacheRow[];
  return rows[0]?{accounts:rows[0].accounts||[],syncedAt:rows[0].synced_at}:null;
}

export async function saveCachedYixiaoerAccounts(accounts:YixiaoerAccount[]){
  const syncedAt=new Date().toISOString();
  await request("yixiaoer_account_cache?on_conflict=id",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({id:"active",accounts,synced_at:syncedAt})});
  return{syncedAt,count:accounts.length};
}
