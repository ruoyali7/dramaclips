"use client";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, LockKeyhole, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Drama, Episode } from "@/lib/types";

function track(name:string, data:Record<string,unknown>) {
  const eventId=crypto.randomUUID();
  const tracking=Object.fromEntries(new URLSearchParams(window.location.search));
  const body=JSON.stringify({eventId,name,schemaVersion:1,occurredAt:new Date().toISOString(),tracking,...data});
  if(navigator.sendBeacon) navigator.sendBeacon("/api/events",new Blob([body],{type:"application/json"}));
  else fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true}).catch(()=>{});
}

export function EpisodePlayer({drama,episodes,goHref,appPromotionHref}:{drama:Drama;episodes:Episode[];goHref:string;appPromotionHref?:string}) {
  const video=useRef<HTMLVideoElement>(null); const [index,setIndex]=useState(0); const [playing,setPlaying]=useState(false); const [muted,setMuted]=useState(true); const [progress,setProgress]=useState(0); const [ended,setEnded]=useState(false); const [copied,setCopied]=useState(false); const episode=episodes[index];
  useEffect(()=>{track("page_view",{dramaId:drama.id,dramaSlug:drama.slug});},[drama.id,drama.slug]);
  const play=useCallback(()=>{video.current?.play();setPlaying(true);track("episode_start",{dramaId:drama.id,dramaSlug:drama.slug,episodeId:episode.id,episodeNumber:episode.episodeNumber});},[drama.id,drama.slug,episode]);
  useEffect(()=>{localStorage.setItem("dramaclips:last",JSON.stringify({slug:drama.slug,episode:index+1,at:Date.now()}));setEnded(false);setProgress(0);},[drama.slug,index]);
  function select(next:number){if(next<0||next>=episodes.length)return;setIndex(next);setPlaying(false);setTimeout(()=>video.current?.play().then(()=>setPlaying(true)).catch(()=>{}),80);track("next_episode",{dramaId:drama.id,dramaSlug:drama.slug,fromEpisode:episode.episodeNumber,toEpisode:next+1});}
  function onTime(){const el=video.current;if(!el||!el.duration)return;setProgress((el.currentTime/el.duration)*100)}
  function onEnded(){setPlaying(false);track("episode_complete",{dramaId:drama.id,dramaSlug:drama.slug,episodeId:episode.id,episodeNumber:episode.episodeNumber});if(index<episodes.length-1)select(index+1);else setEnded(true)}
  async function copy(){if(!drama.promoCode)return;await navigator.clipboard.writeText(drama.promoCode);setCopied(true);track("promo_code_copy",{dramaId:drama.id,dramaSlug:drama.slug});setTimeout(()=>setCopied(false),1800)}
  async function openFull(event:React.MouseEvent<HTMLAnchorElement>,position:string){
    if(!appPromotionHref)return;
    event.preventDefault();
    if(drama.promoCode){try{await navigator.clipboard.writeText(drama.promoCode);track("promo_code_copy",{dramaId:drama.id,dramaSlug:drama.slug,metadata:{reason:"full_cta"}})}catch{/* Continue to the app even when clipboard permission is unavailable. */}}
    window.location.assign(appPromotionHref);
  }
  return <div className="watch-stage"><div className="vertical-player">
    <video ref={video} src={episode.videoUrl} poster={drama.coverUrl} muted={muted} playsInline preload="metadata" onTimeUpdate={onTime} onEnded={onEnded} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}/>
    <button className="player-hit" onClick={()=>playing?video.current?.pause():play()} aria-label={playing?"Pause":"Play"}>{!playing&&<Play fill="currentColor"/>}</button>
    <div className="player-top"><span>EP {episode.episodeNumber}</span><small>Free preview</small></div>
    <div className="player-controls"><button onClick={()=>setMuted(!muted)} aria-label={muted?"Unmute":"Mute"}>{muted?<VolumeX/>:<Volume2/>}</button><button onClick={()=>playing?video.current?.pause():play()}>{playing?<Pause fill="currentColor"/>:<Play fill="currentColor"/>}</button></div>
    <div className="video-progress"><i style={{width:`${progress}%`}}/></div>
    {ended&&<div className="unlock-overlay"><LockKeyhole/><h3>Ready for the full story?</h3><p>Continue all remaining episodes in the official app.</p><a href={appPromotionHref||goHref} onClick={event=>{track("watch_full_click",{dramaId:drama.id,dramaSlug:drama.slug,position:"episode_end"});void openFull(event,"episode_end")}}>Watch full series <ExternalLink/></a></div>}
  </div><div className="episode-rail"><div><span>Now playing</span><strong>Episode {episode.episodeNumber}: {episode.title}</strong></div><div className="rail-buttons"><button onClick={()=>select(index-1)} disabled={index===0}><ChevronLeft/></button><button onClick={()=>select(index+1)} disabled={index===episodes.length-1}><ChevronRight/></button></div><div className="episode-dots">{episodes.map((item,i)=><button className={i===index?"active":""} onClick={()=>select(i)} key={item.id}><span>{i<index?<Check/>:item.episodeNumber}</span><small>EP {item.episodeNumber}</small></button>)}<button className="locked" onClick={()=>setEnded(true)}><span><LockKeyhole/></span><small>Full series</small></button></div></div>
  <aside className="watch-info"><span className="watch-kicker">#{drama.publicCode} · {drama.tags.join(" · ")}</span><h1>{drama.title}</h1><p>{drama.hook}</p><a className="watch-full" href={appPromotionHref||goHref} onClick={event=>{track("watch_full_click",{dramaId:drama.id,dramaSlug:drama.slug,position:"below_player"});void openFull(event,"below_player")}}><Play fill="currentColor"/> Watch full series <ExternalLink/></a><small>{appPromotionHref?"Your Content Code is copied automatically. Open ReelShort and paste it into the search bar to find this drama.":"Continue on ReelShort, DramaBox, or the available official app."}</small>{drama.promoCode&&<button className="rs-code" onClick={copy}><div><span>ReelShort search code</span><strong>{drama.promoCode}</strong></div>{copied?<Check/>:<Copy/>}</button>}<details><summary>About this drama</summary><p>{drama.description}</p></details></aside>
  </div>;
}
