"use client";

import { Check, Copy, ExternalLink, Link2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { Drama } from "@/lib/types";

type ShortLink = { id:string; code:string; dramaSlug:string; source:string; account:string; campaign:string; clip:string; createdAt:string };
const platforms = [
  ["tiktok", "TikTok"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["facebook", "Facebook"], ["x", "X"],
] as const;

export function TrackingLinkBuilder({ dramas, episodeNumbers, siteUrl }:{ dramas:Drama[]; episodeNumbers:Record<string,number[]>; siteUrl:string }) {
  const [slug,setSlug]=useState(dramas[0]?.slug||"");
  const [sources,setSources]=useState<string[]>(platforms.map(([value])=>value));
  const [account,setAccount]=useState("");
  const [campaign,setCampaign]=useState("");
  const firstEpisode=episodeNumbers[dramas[0]?.slug||""]?.[0];
  const [clip,setClip]=useState(firstEpisode?`ep-${String(firstEpisode).padStart(2,"0")}`:"");
  const [created,setCreated]=useState<ShortLink[]>([]);
  const [recent,setRecent]=useState<ShortLink[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [copied,setCopied]=useState("");
  const drama=dramas.find(item=>item.slug===slug);
  const availableEpisodes=episodeNumbers[slug]||[];
  const episodeLabel=clip.replace("ep-", "EP ").replace(/^EP 0/, "EP ");

  useEffect(()=>{fetch("/api/admin/short-links").then(async response=>response.ok?(await response.json()).links:[]).then(setRecent).catch(()=>{})},[]);
  const packs=useMemo(()=>created.map(link=>{
    const url=`${siteUrl}/x/${link.code}`;
    return {...link,url,caption:`${drama?.title || "Watch this drama"} · ${episodeLabel}\nWatch the free episodes: ${url}`};
  }),[created,drama?.title,episodeLabel,siteUrl]);

  function selectDrama(nextSlug:string){setSlug(nextSlug);const episode=episodeNumbers[nextSlug]?.[0];setClip(episode?`ep-${String(episode).padStart(2,"0")}`:"");setCreated([]);setError("")}
  function toggleSource(value:string){setSources(current=>current.includes(value)?current.filter(item=>item!==value):[...current,value]);setCreated([])}
  async function generate(){
    if(!clip||!sources.length){setError(!clip?"This drama has no uploaded preview episodes.":"Select at least one platform.");return}
    setBusy(true);setError("");setCreated([]);
    try {
      const links=await Promise.all(sources.map(async source=>{
        const response=await fetch("/api/admin/short-links",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({dramaSlug:slug,source,account,campaign,clip})});
        const json=await response.json();
        if(!response.ok)throw new Error(json.message||`Could not create ${source} link`);
        return json.link as ShortLink;
      }));
      setCreated(links);setRecent(rows=>[...links,...rows].slice(0,20));
    } catch(reason){setError(reason instanceof Error?reason.message:"Could not create distribution pack")}
    finally{setBusy(false)}
  }
  async function copy(value:string,key:string){await navigator.clipboard.writeText(value);setCopied(key);setTimeout(()=>setCopied(""),1600)}

  return <div className="link-builder">
    <div className="builder-fields">
      <label><span>Drama</span><select value={slug} onChange={event=>selectDrama(event.target.value)}>{dramas.map(item=><option value={item.slug} key={item.id}>{item.title} · {item.publicCode}</option>)}</select></label>
      <label><span>Episode · required</span><select value={clip} onChange={event=>{setClip(event.target.value);setCreated([])}} disabled={!availableEpisodes.length}>{availableEpisodes.length?availableEpisodes.map(episode=><option value={`ep-${String(episode).padStart(2,"0")}`} key={episode}>EP {episode}</option>):<option value="">No uploaded episodes</option>}</select><small>Select the episode used by this social clip.</small></label>
      <label><span>Account · optional</span><input value={account} onChange={event=>setAccount(event.target.value)} placeholder="e.g. dramaclips"/><small>Use one label when the same brand account name is used across platforms.</small></label>
      <label><span>Campaign · optional</span><input value={campaign} onChange={event=>setCampaign(event.target.value)} placeholder="e.g. august_launch"/><small>Groups this batch together in analytics.</small></label>
    </div>
    <div className="platform-picker"><span>Platforms · select all you will publish to</span><div>{platforms.map(([value,label])=><label className={sources.includes(value)?"selected":""} key={value}><input type="checkbox" checked={sources.includes(value)} onChange={()=>toggleSource(value)}/>{label}</label>)}</div></div>
    <button className="create-short-link" onClick={()=>void generate()} disabled={busy||!slug||!clip||!sources.length}><Link2/>{busy?"Generating platform links…":`Generate ${sources.length} platform link${sources.length===1?"":"s"}`}</button>
    {error&&<div className="form-error">{error.includes("short_links")?"Run the Supabase analytics migration first.":error}</div>}
    {packs.length>0&&<div className="distribution-pack"><div className="pack-heading"><div><span>Distribution pack</span><b>{drama?.title} · {episodeLabel}</b></div><button onClick={()=>void copy(packs.map(pack=>`${pack.source.toUpperCase()}\n${pack.caption}`).join("\n\n"),"all")}>{copied==="all"?<Check/>:<Copy/>}{copied==="all"?"Copied":"Copy all"}</button></div>{packs.map(pack=><div className="platform-pack" key={pack.id}><b>{platforms.find(([value])=>value===pack.source)?.[1]||pack.source}</b><code>{pack.url}</code><p>{pack.caption}</p><div><button onClick={()=>void copy(pack.caption,pack.id)}>{copied===pack.id?<Check/>:<Copy/>}{copied===pack.id?"Copied":"Copy caption + link"}</button><a href={pack.url} target="_blank" rel="noreferrer">Test <ExternalLink/></a></div></div>)}</div>}
    <div className="link-note"><b>One setup, separate attribution</b><p>DramaClips creates the correct short URL for every selected platform. Paste each ready caption into the matching Vizard scheduled post—no URL editing needed.</p></div>
    {recent.length>0&&<div className="recent-links"><span>Recent links</span>{recent.map(link=><div key={link.id}><code>{siteUrl}/x/{link.code}</code><small>{link.source} · {link.dramaSlug} · {link.clip}</small><button onClick={()=>void copy(`${siteUrl}/x/${link.code}`,`recent-${link.id}`)}>{copied===`recent-${link.id}`?<Check/>:<Copy/>}</button></div>)}</div>}
  </div>;
}
