import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseConfig } from "@/lib/admin/supabase-config";
const schema=z.object({workerId:z.string().min(3).max(120),leaseSeconds:z.number().int().min(60).max(900).default(300)});
function ok(r:NextRequest){const t=process.env.HOOK_WORKER_TOKEN;return Boolean(t&&(r.headers.get("x-hook-worker-token")===t||r.headers.get("authorization")===`Bearer ${t}`));}
export async function POST(r:NextRequest){if(!ok(r))return NextResponse.json({message:"Unauthorized"},{status:401});try{const i=schema.parse(await r.json()),c=getSupabaseConfig();if(!c.configured)throw new Error("Supabase is not configured");const q=await fetch(`${c.url}/rest/v1/rpc/lease_vizard_submission_job`,{method:"POST",headers:{apikey:c.key,Authorization:`Bearer ${c.key}`,"Content-Type":"application/json"},body:JSON.stringify({p_worker_id:i.workerId,p_lease_seconds:i.leaseSeconds})});if(!q.ok)throw new Error(`Supabase ${q.status}`);const rows=await q.json();return NextResponse.json({job:rows[0]||null});}catch(e){return NextResponse.json({message:e instanceof Error?e.message:"Could not lease Vizard job"},{status:503});}}
