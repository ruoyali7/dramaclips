"use client";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, LockKeyhole, Pause, Play, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { trackClientEvent } from "@/lib/client-events";
import type { Episode, PublicDrama } from "@/lib/types";
import { AffiliateCta } from "./affiliate-cta";

type SavedProgress = { slug?: string; episode?: number; positionSeconds?: number; at?: number };

export function EpisodePlayer({drama,episodes,goHref}:{drama:PublicDrama;episodes:Episode[];goHref:string}) {
  const video=useRef<HTMLVideoElement>(null); const startedEpisodes=useRef(new Set<string>()); const completedEpisodes=useRef(new Set<string>()); const activeEpisode=useRef(episodes[0].episodeNumber); const resumeEpisode=useRef<number>(); const resumeTime=useRef(0); const lastProgressSave=useRef(0);
  const [index,setIndex]=useState(0); const [ready,setReady]=useState(false); const [playing,setPlaying]=useState(false); const [muted,setMuted]=useState(true); const [progress,setProgress]=useState(0); const [ended,setEnded]=useState(false); const [copied,setCopied]=useState(false); const [videoStatus,setVideoStatus]=useState<"loading"|"ready"|"error">("loading");
  const episode=episodes[index];

  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem("dramaclips:last")||"null") as SavedProgress|null;
      if(saved?.slug===drama.slug&&typeof saved.episode==="number"){
        const savedIndex=episodes.findIndex(item=>item.episodeNumber===saved.episode);
        if(savedIndex>=0){activeEpisode.current=saved.episode;setIndex(savedIndex);resumeEpisode.current=saved.episode;resumeTime.current=Math.max(0,saved.positionSeconds||0);}
      }
    } catch { /* Start from the first preview when saved state is invalid. */ }
    setReady(true);
  },[drama.slug,episodes]);

  const saveProgress=useCallback((positionSeconds=0)=>{
    localStorage.setItem("dramaclips:last",JSON.stringify({slug:drama.slug,episode:activeEpisode.current,positionSeconds,at:Date.now()}));
  },[drama.slug]);
  useEffect(()=>{
    setEnded(false);setProgress(0);setVideoStatus("loading");
    if(ready&&!(resumeEpisode.current===episode.episodeNumber&&resumeTime.current>0))saveProgress();
  },[episode.episodeNumber,ready,saveProgress]);

  const play=useCallback(()=>{setVideoStatus(current=>current==="error"?current:"loading");void video.current?.play().catch(()=>setPlaying(false));},[]);
  const onPlay=useCallback(()=>{setPlaying(true);setVideoStatus("ready");if(startedEpisodes.current.has(episode.id))return;startedEpisodes.current.add(episode.id);trackClientEvent("episode_start",{dramaId:drama.id,dramaSlug:drama.slug,episodeId:episode.id,episodeNumber:episode.episodeNumber});},[drama.id,drama.slug,episode]);
  function select(next:number){if(next<0||next>=episodes.length)return;video.current?.pause();activeEpisode.current=episodes[next].episodeNumber;resumeEpisode.current=undefined;resumeTime.current=0;saveProgress();setIndex(next);setPlaying(false);setTimeout(()=>video.current?.play().then(()=>setPlaying(true)).catch(()=>{}),80);trackClientEvent("next_episode",{dramaId:drama.id,dramaSlug:drama.slug,fromEpisode:episode.episodeNumber,toEpisode:episodes[next].episodeNumber});}
  function onTime(){const el=video.current;if(!el||!el.duration)return;setProgress((el.currentTime/el.duration)*100);if(Date.now()-lastProgressSave.current>2000){saveProgress(el.currentTime);lastProgressSave.current=Date.now();}}
  function restoreTime(){const el=video.current;if(!el)return;if(resumeEpisode.current===episode.episodeNumber&&resumeTime.current>0){el.currentTime=Math.min(resumeTime.current,Math.max(0,el.duration-1));resumeEpisode.current=undefined;resumeTime.current=0;}setVideoStatus("ready");}
  function seekRatio(ratio:number){const el=video.current;if(!el||!el.duration)return;const bounded=Math.max(0,Math.min(1,ratio));el.currentTime=bounded*el.duration;setProgress(bounded*100);saveProgress(el.currentTime);}
  function seek(event:React.PointerEvent<HTMLDivElement>){const rect=event.currentTarget.getBoundingClientRect();seekRatio((event.clientX-rect.left)/rect.width);}
  function seekWithKeyboard(event:React.KeyboardEvent<HTMLDivElement>){const el=video.current;if(!el||!el.duration)return;let next:number|undefined;if(event.key==="ArrowLeft"||event.key==="ArrowDown")next=el.currentTime-5;if(event.key==="ArrowRight"||event.key==="ArrowUp")next=el.currentTime+5;if(event.key==="Home")next=0;if(event.key==="End")next=el.duration;if(next===undefined)return;event.preventDefault();seekRatio(next/el.duration);}
  function retry(){const el=video.current;if(!el)return;setVideoStatus("loading");el.load();void el.play().catch(()=>{});}
  function onEnded(){setPlaying(false);saveProgress(0);if(!completedEpisodes.current.has(episode.id)){completedEpisodes.current.add(episode.id);trackClientEvent("episode_complete",{dramaId:drama.id,dramaSlug:drama.slug,episodeId:episode.id,episodeNumber:episode.episodeNumber});}if(index<episodes.length-1)select(index+1);else setEnded(true);}
  async function copy(){if(!drama.promoCode)return;try{await navigator.clipboard.writeText(drama.promoCode);setCopied(true);trackClientEvent("promo_code_copy",{dramaId:drama.id,dramaSlug:drama.slug,metadata:{reason:"manual"}});setTimeout(()=>setCopied(false),1800);}catch{setCopied(false);}}
  return <div className="watch-stage"><div className="vertical-player">
    <video ref={video} src={episode.videoUrl} poster={drama.coverUrl} muted={muted} playsInline preload="metadata" onTimeUpdate={onTime} onLoadedMetadata={restoreTime} onCanPlay={()=>setVideoStatus("ready")} onWaiting={()=>setVideoStatus("loading")} onError={()=>{setPlaying(false);setVideoStatus("error")}} onEnded={onEnded} onPlay={onPlay} onPause={()=>setPlaying(false)}/>
    <button className="player-hit" onClick={()=>playing?video.current?.pause():play()} aria-label={playing?"Pause preview":"Play preview"}>{!playing&&videoStatus!=="error"&&<Play fill="currentColor"/>}</button>
    <div className="player-top"><span>EP {episode.episodeNumber}</span><small>Free preview</small></div>
    {videoStatus==="loading"&&<div className="player-status" role="status">Loading preview…</div>}
    {videoStatus==="error"&&<div className="player-error" role="alert"><strong>Preview couldn’t load</strong><span>Check your connection and try again.</span><button onClick={retry}><RefreshCw/> Retry</button></div>}
    <div className="player-controls"><button onClick={()=>setMuted(!muted)} aria-label={muted?"Unmute preview":"Mute preview"}>{muted?<VolumeX/>:<Volume2/>}</button><button onClick={()=>playing?video.current?.pause():play()} aria-label={playing?"Pause preview":"Play preview"}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button></div>
    <div className="video-progress" role="slider" tabIndex={0} aria-label="Video progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} onKeyDown={seekWithKeyboard} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);seek(event)}} onPointerMove={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))seek(event)}}><i style={{width:`${progress}%`}}/></div>
    {ended&&<div className="unlock-overlay"><LockKeyhole/><h3>The story isn&apos;t over.</h3><p>Discover what happens next in the official app.</p><AffiliateCta href={goHref} code={drama.promoCode} dramaId={drama.id} dramaSlug={drama.slug} position="episode_end">Continue Watching on ReelShort <ExternalLink/></AffiliateCta></div>}
  </div><div className="episode-rail"><div><span>Now playing</span><strong>Episode {episode.episodeNumber}: {episode.title}</strong></div><div className="rail-buttons"><button onClick={()=>select(index-1)} disabled={index===0} aria-label="Previous episode"><ChevronLeft/></button><button onClick={()=>select(index+1)} disabled={index===episodes.length-1} aria-label="Next episode"><ChevronRight/></button></div><div className="episode-dots">{episodes.map((item,i)=><button className={i===index?"active":""} onClick={()=>select(i)} aria-label={`Play episode ${item.episodeNumber}`} aria-current={i===index?"true":undefined} key={item.id}><span>{i<index?<Check/>:item.episodeNumber}</span><small>EP {item.episodeNumber}</small></button>)}<button className="locked" onClick={()=>setEnded(true)} aria-label="Continue to full series"><span><LockKeyhole/></span><small>Full series</small></button></div></div>
  <aside className="watch-info"><span className="watch-kicker">#{drama.publicCode}{drama.tags.slice(0,4).map(tag=>` · ${tag}`).join("")}</span><h1>{drama.title}</h1><p>{drama.hook}</p><AffiliateCta className="watch-full" href={goHref} code={drama.promoCode} dramaId={drama.id} dramaSlug={drama.slug} position="below_player"><Play fill="currentColor"/> Continue Watching on ReelShort <ExternalLink/></AffiliateCta><small>{drama.promoCode?"We’ll try to copy your drama code before ReelShort opens.":"Continue in the official app."}</small>{drama.promoCode&&<button className="rs-code" onClick={copy} aria-label={`Copy ReelShort search code ${drama.promoCode}`}><div><span>ReelShort search code</span><strong>{drama.promoCode}</strong></div>{copied?<Check/>:<Copy/>}<i aria-live="polite">{copied?"Copied":""}</i></button>}<details><summary>About this drama</summary><p>{drama.description}</p></details></aside>
  </div>;
}
