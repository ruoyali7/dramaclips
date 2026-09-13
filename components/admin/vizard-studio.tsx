"use client";
import {useEffect,useState} from "react";
type Source={id:string;title:string;slug:string;language:string;coverUrl?:string;episodes:{episodeNumber:number;videoUrl:string}[]};
export function VizardStudio({sources,initialSourceId,selectedEpisodeNumbers=[]}:{sources:Source[];initialSourceId?:string;selectedEpisodeNumbers?:number[]}){
  const source=sources.find(item=>item.id===initialSourceId)||sources[0];
  const [selected,setSelected]=useState<number[]>(selectedEpisodeNumbers);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState("");
  useEffect(()=>{setSelected(selectedEpisodeNumbers);setError("");setNotice("");},[initialSourceId,selectedEpisodeNumbers]);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!source||busy||!selected.length)return;
    setBusy(true);setError("");setNotice("");const form=new FormData(event.currentTarget);
    try{
      const response=await fetch("/api/admin/vizard/submit-batch",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jobs:source.episodes.filter(episode=>selected.includes(episode.episodeNumber)).map(episode=>({dramaId:source.id,dramaSlug:source.slug,episodeNumber:episode.episodeNumber,projectName:`${source.title} - EP ${episode.episodeNumber}`,videoUrl:episode.videoUrl,settings:{language:form.get("language"),preferLength:Number(form.get("preferLength")),maxClipNumber:Number(form.get("maxClipNumber")),ratio:Number(form.get("ratio")),subtitles:form.get("subtitles")==="on",headline:form.get("headline")==="on",clipModel:form.get("clipModel")}}))})});
      const data=await response.json();if(!response.ok)throw new Error(data.message||"Could not queue episodes");
      setNotice(`${data.jobs.length} new or retried tasks queued. Existing tasks are reused.`);
      if(!["restarted","already_running"].includes(data.workerTrigger?.status))setError("Episodes are queued, but the batch could not start. Use Start queued episodes above to try again.");
      else setNotice(`${data.jobs.length} new or retried tasks queued. Start approved for the whole waiting queue; follow progress above.`);
      window.dispatchEvent(new Event("vizard-queue-changed"));
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not submit episodes");}finally{setBusy(false);}
  }
  if(!source)return <p>Add a drama to select episodes.</p>;
  return <form className="vizard-manual-form" onSubmit={submit}>
    <div className="generator-selected-drama"><img src={source.coverUrl} alt=""/><div><small>Selected drama</small><b>{source.title}</b></div><button type="button" onClick={()=>document.querySelector(".drama-hook-library")?.scrollIntoView({behavior:"smooth",block:"start"})}>Choose from library ↑</button></div>
    <div className="episode-picker-heading"><b>Select episodes</b><div><button type="button" onClick={()=>setSelected(source.episodes.map(episode=>episode.episodeNumber))}>Select all</button><button type="button" onClick={()=>setSelected([])}>Clear</button></div></div>
    <div className="generator-episodes">{source.episodes.map(episode=><label key={episode.episodeNumber} className={selected.includes(episode.episodeNumber)?"selected":""}><input type="checkbox" checked={selected.includes(episode.episodeNumber)} onChange={()=>setSelected(values=>values.includes(episode.episodeNumber)?values.filter(number=>number!==episode.episodeNumber):[...values,episode.episodeNumber])}/>EP {episode.episodeNumber}</label>)}</div>
    <details className="direction-options"><summary>Clip settings <small>Defaults: vertical · one clip per episode</small></summary><div className="vizard-grid" key={source.id}>
      <label>Language<select name="language" defaultValue={source.language||"auto"}><option value="auto">Auto detect</option><option value="en">English</option><option value="zh">Chinese</option><option value="es">Spanish</option></select></label>
      <label>Clip length<select name="preferLength" defaultValue="0"><option value="0">Auto</option><option value="1">Under 30 sec</option><option value="2">30–60 sec</option><option value="3">60–90 sec</option><option value="4">90 sec–3 min</option></select></label>
      <label>Max clips / episode<input name="maxClipNumber" type="number" min="1" max="20" defaultValue="1"/></label>
      <label>Ratio<select name="ratio" defaultValue="1"><option value="1">9:16</option><option value="2">1:1</option><option value="3">4:5</option><option value="4">16:9</option></select></label>
      <label>Model<select name="clipModel" defaultValue="clip_v1"><option value="clip_v1">Clip v1</option><option value="clip_v2">Clip v2</option></select></label>
    </div><div className="vizard-switches"><label><input type="checkbox" name="subtitles"/> Auto subtitles</label><label><input type="checkbox" name="headline" defaultChecked/> AI headline</label></div></details>
    <p className="task-help">Submitting adds these episodes and starts the entire waiting Vizard queue across all dramas. Already submitted tasks are reused. Failed submissions can be retried here after reviewing the error.</p>
    <button className="primary-button" disabled={busy||!selected.length}>{busy?"Queueing…":`Queue ${selected.length} episodes & start waiting batch`}</button>
    {notice&&<p className="operation-notice" role="status">{notice}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
  </form>;
}
