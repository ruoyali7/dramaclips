"use client";

import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {Play, RefreshCw} from "lucide-react";
import {useAdaptivePolling} from "@/lib/use-adaptive-polling";

type Job = {id:string;dramaSlug:string;episodeNumber:number;status:string;errorMessage?:string;updatedAt:string};
type Project = {id:string;dramaSlug:string;episodeNumber:number;status:string;updatedAt:string};
type Source = {id:string;slug:string;title:string;coverUrl?:string};
const labels:Record<string,string> = {queued:"Waiting for start",submitting:"Submitting to Vizard",rate_limited:"Waiting for rate limit",failed:"Needs attention",submitted:"Awaiting Vizard result",editing:"Processing",ready:"Saved to library"};

export function VizardQueue({sources}:{sources:Source[]}){
  const router=useRouter();
  const [jobs,setJobs]=useState<Job[]>([]),[projects,setProjects]=useState<Project[]>([]);
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  const [filter,setFilter]=useState("all");
  const fingerprint=useRef("");
  async function refresh(){
    try{
      const response=await fetch("/api/admin/vizard/worker",{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Could not load queue");
      setJobs(data.jobs);setProjects(data.projects);setLoaded(true);setError("");
      const next=JSON.stringify([data.jobs,data.projects]);
      if(fingerprint.current&&next!==fingerprint.current)router.refresh();
      fingerprint.current=next;
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not refresh queue");}
  }
  useEffect(()=>{void refresh();const changed=()=>void refresh();window.addEventListener("vizard-queue-changed",changed);return()=>window.removeEventListener("vizard-queue-changed",changed);},[]);
  useAdaptivePolling(true,refresh);
  const waiting=jobs.filter(job=>["queued","rate_limited"].includes(job.status));
  const submitting=jobs.filter(job=>job.status==="submitting");
  const activeProjects=projects.filter(project=>!["ready","archived"].includes(project.status));
  const failed=jobs.filter(job=>job.status==="failed");
  const dramaCount=new Set(waiting.map(job=>job.dramaSlug)).size;
  const rows:(Job|Project)[]=[...jobs.filter(job=>!["submitted","canceled"].includes(job.status)),...activeProjects.filter(project=>!jobs.some(job=>job.dramaSlug===project.dramaSlug&&job.episodeNumber===project.episodeNumber&&!["submitted","canceled"].includes(job.status)))];
  async function start(){
    setBusy(true);setNotice("");setError("");
    try{
      const response=await fetch("/api/admin/vizard/worker",{method:"POST"});const data=await response.json();
      if(!response.ok)throw new Error(data.message||"Could not start generation");
      setNotice(data.workerTrigger.status==="already_running"?"The submission batch is already running. Progress appears below.":"Start requested. Episodes will move to Submitting when the worker picks them up.");
      await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not start generation");}finally{setBusy(false);}
  }
  async function saveRecovery(event:React.FormEvent<HTMLFormElement>,project:Project){
    event.preventDefault();setError("");setNotice("");const form=new FormData(event.currentTarget);
    try{
      const response=await fetch("/api/admin/vizard/projects",{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({id:project.id,status:"ready",finalVideoUrl:String(form.get("finalVideoUrl")||""),finalLabel:String(form.get("finalLabel")||""),editInfo:{notes:String(form.get("notes")||""),template:String(form.get("template")||""),subtitleStyle:String(form.get("subtitleStyle")||""),selectedRanges:String(form.get("selectedRanges")||"")}})});
      if(!response.ok)throw new Error((await response.json()).message||"Could not save recovery");
      setNotice("Manual result saved.");await refresh();
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not save recovery");}
  }
  return <section className="generation-queue-panel" aria-label="Vizard generation queue">
    <div className="operations-heading"><div><span className="eyebrow">01 · Generation queue</span><h2>Ready when you are</h2><p>Add Drama queues every episode. Approve one batch across all waiting dramas.</p></div><button className="secondary-button" onClick={()=>void refresh()} aria-label="Refresh generation queue"><RefreshCw size={16}/> Refresh</button></div>
    <div className="operations-metrics"><div><b>{loaded?waiting.length:"—"}</b><span>Waiting to start</span></div><div><b>{submitting.length+activeProjects.filter(project=>project.status!=="failed").length}</b><span>In progress</span></div><div><b>{failed.length+activeProjects.filter(project=>project.status==="failed").length}</b><span>Need attention</span></div><div><b>{projects.filter(project=>project.status==="ready").length}</b><span>Completed projects</span></div></div>
    <div className="queue-approval"><div><b>{waiting.length} episodes · {dramaCount} dramas</b><p>{Array.from(new Set(waiting.map(job=>job.dramaSlug))).map(slug=>sources.find(source=>source.slug===slug)?.title||slug).join(" · ")||"New episodes will appear here automatically."}</p><small>Applies to the whole waiting queue, including dramas outside the current filter. Failed jobs need review first. A run may stop at its batch limit; any remaining episodes stay queued.</small></div><button className="primary-button" disabled={!loaded||!waiting.length||busy||submitting.length>0} onClick={()=>void start()}><Play size={17}/>{busy?"Requesting start…":submitting.length?"Submitting batch…":`Start ${waiting.length} queued episodes`}</button></div>
    {notice&&<p className="operation-notice" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
    <div className="queue-filter"><label>Show <select value={filter} onChange={event=>setFilter(event.target.value)}><option value="all">All tasks</option><option value="waiting">Waiting</option><option value="active">In progress</option><option value="failed">Needs attention</option></select></label></div>
    <div className="generation-queue-list">{rows.filter(row=>filter==="all"||filter==="waiting"&&["queued","rate_limited"].includes(row.status)||filter==="active"&&["submitting","submitted","editing"].includes(row.status)||filter==="failed"&&row.status==="failed").map(row=><article key={row.id}><div><b>{sources.find(source=>source.slug===row.dramaSlug)?.title||row.dramaSlug}</b><small>Episode {row.episodeNumber}</small></div><span className={`queue-state ${row.status}`}>{labels[row.status]||row.status}</span>{row.status==="failed"&&<div><small>Review the provider result before submitting again.</small>{"errorMessage" in row&&Boolean(row.errorMessage)&&<details><summary>Error details</summary><p>{String(row.errorMessage)}</p></details>}</div>}</article>)}</div>
    {loaded&&!rows.length&&<p className="operation-empty">No pending tasks. Generated hooks are available in the library below.</p>}
    {activeProjects.length>0&&<details className="manual-recovery"><summary>Manual recovery · {activeProjects.length} unfinished projects</summary><p>Use only when Vizard has finished but automatic import did not complete.</p>{activeProjects.map(project=><form key={project.id} onSubmit={event=>void saveRecovery(event,project)}><b>{sources.find(source=>source.slug===project.dramaSlug)?.title||project.dramaSlug} · EP {project.episodeNumber}</b><label>Final video URL<input name="finalVideoUrl" type="url" required/></label><label>Asset label<input name="finalLabel" defaultValue={`${project.dramaSlug} · EP ${project.episodeNumber}`}/></label><details><summary>Recovery notes</summary><label>Notes<textarea name="notes"/></label><label>Template<input name="template"/></label><label>Subtitle style<input name="subtitleStyle"/></label><label>Selected ranges<input name="selectedRanges"/></label></details><button type="submit" className="secondary-button">Save manual fallback</button></form>)}</details>}
  </section>;
}
