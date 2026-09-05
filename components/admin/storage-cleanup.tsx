"use client";
import {CheckCircle2,LoaderCircle,Search,ShieldCheck,Trash2} from "lucide-react";
import {useState} from "react";

type Item={id?:string;key?:string;label?:string;reason:string;bytes?:number};
type Plan={fingerprint:string;generatedAt:string;totals:{records:number;r2Drafts:number;r2Bytes:number};categories:{publishPackages:Item[];hookJobs:Item[];vizardProjects:Item[];r2Drafts:Item[]};protected:{activeJobs:number;savedJobs:number;referencedHookClips:number;referencedDrafts:number;vizardWithAssets:number}};
const sections:[keyof Plan["categories"],string][]=[["publishPackages","Publish records"],["hookJobs","Built-in jobs"],["vizardProjects","Vizard projects"],["r2Drafts","R2 hook drafts"]];

export function StorageCleanup(){
 const[busy,setBusy]=useState(false),[plan,setPlan]=useState<Plan|null>(null),[completed,setCompleted]=useState<Plan|null>(null),[error,setError]=useState("");
 async function request(body:Record<string,string>){setBusy(true);setError("");try{const response=await fetch("/api/admin/storage-cleanup",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)}),json=await response.json();if(!response.ok)throw new Error(json.message||"Cleanup failed");return json.result as Plan}catch(reason){setError(reason instanceof Error?reason.message:"Cleanup failed");return null}finally{setBusy(false)}}
 async function scan(){const result=await request({mode:"preview"});if(result){setPlan(result);setCompleted(null)}}
 async function clean(){if(!plan)return;const total=plan.totals.records+plan.totals.r2Drafts;if(!total)return;if(!window.confirm(`Delete exactly ${plan.totals.records} database records and ${plan.totals.r2Drafts} unreferenced R2 drafts from this reviewed plan?`))return;const result=await request({mode:"execute",fingerprint:plan.fingerprint});if(result){setCompleted(result);setPlan(null)}}
 const total=(plan?.totals.records||0)+(plan?.totals.r2Drafts||0);
 return <section className="panel key-rotation-card storage-cleanup-card">
  <span>Storage maintenance</span><h2>Safe cleanup</h2>
  <p>Scan first. Nothing is deleted until you review the exact plan and confirm again. Active jobs, pending review, Saved Hooks, scheduled/published packages, original episodes, and Vizard projects with assets are protected.</p>
  <button onClick={()=>void scan()} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<Search/>}{busy?"Scanning references…":plan?"Refresh cleanup plan":"Scan cleanup candidates"}</button>
  {plan&&<div className="cleanup-plan">
   <div className="cleanup-plan-summary"><div><b>{plan.totals.records}</b><small>database records</small></div><div><b>{plan.totals.r2Drafts}</b><small>R2 drafts</small></div><div><b>{(plan.totals.r2Bytes/1048576).toFixed(1)} MB</b><small>recoverable</small></div></div>
   <div className="cleanup-protected"><ShieldCheck/><span>Protected: {plan.protected.activeJobs} active jobs · {plan.protected.savedJobs} jobs with Saved Hooks · {plan.protected.referencedHookClips} published Hook references · {plan.protected.referencedDrafts} referenced drafts · {plan.protected.vizardWithAssets} Vizard projects with assets</span></div>
   {sections.map(([key,title])=>plan.categories[key].length?<details key={key}><summary><b>{title}</b><span>{plan.categories[key].length}</span></summary>{plan.categories[key].map((item,index)=><div className="cleanup-item" key={item.id||item.key||index}><code>{item.label||item.key}</code><small>{item.reason}{item.bytes?` · ${(item.bytes/1048576).toFixed(1)} MB`:""}</small></div>)}</details>:null)}
   {!total?<div className="cleanup-empty"><CheckCircle2/><span>Nothing currently qualifies for safe deletion.</span></div>:<button className="cleanup-delete" onClick={()=>void clean()} disabled={busy}><Trash2/>Delete reviewed plan</button>}
  </div>}
  {completed&&<div className="cleanup-result"><CheckCircle2/><div><b>Cleanup complete</b><small>{completed.totals.records} database records · {completed.totals.r2Drafts} R2 drafts · {(completed.totals.r2Bytes/1048576).toFixed(1)} MB</small></div></div>}
  {error&&<div className="form-error">{error}</div>}
 </section>
}
