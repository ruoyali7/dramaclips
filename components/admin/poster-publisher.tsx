"use client";

import {AlertCircle,Check,Clock3,Download,ExternalLink,Instagram,Link2,RefreshCw,Search,ShieldCheck} from "lucide-react";
import {useEffect,useMemo,useRef,useState} from "react";

type PosterSource={id:string;title:string;slug:string;contentCode:string;coverUrl:string;sourceCoverUrl:string;description:string;tags:string[];contentPromotionUrl:string};
type StoryJob={id:string;drama_slug:string;drama_title:string;selection_source:"daily_post"|"library"|"manual";status:string;scheduled_at:string;published_at?:string;story_result?:Record<string,unknown>;error?:string};
type InstagramConnection={sessionIdConfigured:boolean;settingsConfigured:boolean};

function drawPoster(canvas:HTMLCanvasElement,image:HTMLImageElement,code:string){
  const width=1080,height=1920;canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");if(!context)return;
  context.fillStyle="#111";context.fillRect(0,0,width,height);
  const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),imageWidth=image.naturalWidth*scale,imageHeight=image.naturalHeight*scale;
  context.drawImage(image,(width-imageWidth)/2,(height-imageHeight)/2,imageWidth,imageHeight);
  const label=`CONTENT CODE · ${code}`;context.font="700 30px Arial, sans-serif";const labelWidth=context.measureText(label).width+48;
  context.fillStyle="rgba(0,0,0,.76)";context.fillRect(34,34,labelWidth,66);context.fillStyle="#fff";context.fillText(label,58,75);
  context.save();context.shadowColor="rgba(0,0,0,.42)";context.shadowBlur=20;context.shadowOffsetY=9;context.beginPath();context.roundRect(230,960,620,125,28);context.fillStyle="#fff";context.fill();context.restore();
  context.save();context.translate(298,1022);context.rotate(-Math.PI/4);context.lineWidth=8;context.lineCap="round";context.lineJoin="round";
  context.strokeStyle="#ff27ae";context.beginPath();context.roundRect(-42,-13,50,26,13);context.stroke();
  context.strokeStyle="#ff7e18";context.beginPath();context.roundRect(-8,-13,50,26,13);context.stroke();context.restore();
  context.font="700 52px 'Arial Narrow','Roboto Condensed',Arial,sans-serif";context.fillStyle="#181818";context.textBaseline="middle";context.fillText("TAP TO WATCH",345,1022);context.textBaseline="alphabetic";
}
function loadImage(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin="anonymous";image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("The poster could not be loaded."));image.src=url;if(image.complete&&image.naturalWidth)resolve(image);});}
function saveCanvas(canvas:HTMLCanvasElement,name:string){return new Promise<void>((resolve,reject)=>canvas.toBlob(blob=>{if(!blob){reject(new Error("The poster could not be generated."));return;}const url=URL.createObjectURL(blob),link=document.createElement("a");link.download=name;link.href=url;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);resolve();},"image/jpeg",.94));}
function storyStatus(job:StoryJob){if(job.status==="published")return job.story_result?.linkVerified===true?"Published · link verified":"Published";if(job.status==="outcome_unknown")return "Needs verification";return job.status.charAt(0).toUpperCase()+job.status.slice(1);}
function storyEligible(source:PosterSource){try{const url=new URL(source.contentPromotionUrl);return url.protocol==="https:"&&(url.hostname==="reelslink.com"||url.hostname.endsWith(".reelslink.com"))}catch{return false}}

export function PosterPublisher({sources}:{sources:PosterSource[]}){
  const [sourceId,setSourceId]=useState(sources[0]?.id||"");
  const [query,setQuery]=useState("");
  const [jobs,setJobs]=useState<StoryJob[]>([]);
  const [loadingJobs,setLoadingJobs]=useState(true);
  const [extensionReady,setExtensionReady]=useState(false);
  const [connection,setConnection]=useState<InstagramConnection|null>(null);
  const [connecting,setConnecting]=useState(false);
  const [message,setMessage]=useState<{kind:"success"|"error";text:string}|null>(null);
  const [previewError,setPreviewError]=useState("");
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const source=sources.find(item=>item.id===sourceId)||sources[0];
  const visibleSources=useMemo(()=>sources.filter(item=>`${item.title} ${item.contentCode}`.toLowerCase().includes(query.trim().toLowerCase())),[sources,query]);
  const published=jobs.filter(job=>job.status==="published").length;
  const nextJob=jobs.find(job=>job.status==="scheduled");
  const eligibleCount=sources.filter(storyEligible).length;

  async function refreshStories(){try{const response=await fetch("/api/admin/instagram-stories");if(!response.ok)throw new Error();const result=await response.json();setJobs((result.jobs||[]).sort((a:StoryJob,b:StoryJob)=>a.drama_title.localeCompare(b.drama_title)));}catch{}finally{setLoadingJobs(false)}}
  async function refreshConnection(){try{const response=await fetch("/api/admin/instagram-session");if(!response.ok)throw new Error();const result=await response.json();setConnection(result.connection);}catch{setConnection(null)}}
  useEffect(()=>{void refreshStories();const timer=window.setInterval(()=>void refreshStories(),15000);return()=>window.clearInterval(timer)},[]);
  useEffect(()=>{
    function receiveExtensionMessage(event:MessageEvent){
      if(event.source!==window||event.origin!==window.location.origin||event.data?.source!=="dramaclips-rs-extension")return;
      if(event.data.type==="RS_EXTENSION_READY")setExtensionReady(true);
      if(event.data.type==="INSTAGRAM_LOGIN_OPEN_RESULT"&&!event.data.ok)setMessage({kind:"error",text:event.data.message||"Could not open Instagram login."});
      if(event.data.type==="INSTAGRAM_SESSION_CONNECT_RESULT"){
        setConnecting(false);
        if(event.data.ok){void refreshConnection();setMessage({kind:"success",text:"Instagram session saved. The Story worker can now verify it."});}
        else setMessage({kind:"error",text:event.data.message||"Could not connect Instagram."});
      }
    }
    window.addEventListener("message",receiveExtensionMessage);
    window.postMessage({source:"dramaclips",type:"RS_EXTENSION_PING"},window.location.origin);
    void refreshConnection();
    return()=>window.removeEventListener("message",receiveExtensionMessage);
  },[]);
  useEffect(()=>{if(!source||!canvasRef.current)return;let active=true;setPreviewError("");void loadImage(source.coverUrl).then(image=>{if(active&&canvasRef.current)drawPoster(canvasRef.current,image,source.contentCode)}).catch(error=>{if(active)setPreviewError(error instanceof Error?error.message:"The poster could not be loaded.")});return()=>{active=false}},[source]);

  async function downloadCurrent(){if(!source||!canvasRef.current)return;setMessage(null);try{await saveCanvas(canvasRef.current,`${source.slug}-story.jpg`);setMessage({kind:"success",text:`${source.title} Story poster downloaded.`});}catch(error){setMessage({kind:"error",text:error instanceof Error?error.message:"The poster could not be downloaded."});}}
  function openInstagramLogin(){setMessage(null);if(!extensionReady){setMessage({kind:"error",text:"Reload version 1.2.0 of the DramaClips RS Importer extension first."});return;}window.postMessage({source:"dramaclips",type:"INSTAGRAM_LOGIN_OPEN_REQUEST"},window.location.origin)}
  function connectInstagram(){setMessage(null);if(!extensionReady){setMessage({kind:"error",text:"Reload version 1.2.0 of the DramaClips RS Importer extension first."});return;}setConnecting(true);window.postMessage({source:"dramaclips",type:"INSTAGRAM_SESSION_CONNECT_REQUEST"},window.location.origin)}

  if(!sources.length)return <section className="poster-empty"><h2>No published dramas</h2><p>Publish a drama before adding it to Story rotation.</p></section>;
  return <section className="poster-publisher" aria-labelledby="poster-publisher-title">
    <header className="poster-publisher-head"><div><span>Instagram automation</span><h2 id="poster-publisher-title">Story rotation</h2><p>One automatic morning batch · 3 current dramas + 5 library dramas</p></div><div className="story-auto-badge"><i/><span><b>Automatic</b><small>8 Stories / day</small></span></div></header>

    <section className="story-overview">
      <div><small>Today</small><b>{published}<em>/ 8 published</em></b></div>
      <div><small>Batch</small><b>Morning<em>8:30–9:30 AM Pacific</em></b></div>
      <div><small>Rotation</small><b>3 + 5<em>current + library</em></b></div>
      <div><small>Next action</small><b>{nextJob?"Queued":"Tomorrow"}<em>{nextJob?"Railway Story worker":"plan automatically"}</em></b></div>
    </section>

    <section className="instagram-connection">
      <div className="instagram-connection-icon"><Instagram/></div>
      <div className="instagram-connection-copy"><span>Instagram connection</span><h3>{connection?.settingsConfigured?"Connected":connection?.sessionIdConfigured?"Session saved · verification pending":"Sign in once to enable Story publishing"}</h3><p>Login happens on Instagram. After you return, the extension saves only the signed-in session; DramaClips never receives your password.</p></div>
      <div className="instagram-connection-state"><ShieldCheck/><span><b>{extensionReady?"Extension ready":"Extension update required"}</b><small>{connection?.settingsConfigured?"Worker session ready":connection?.sessionIdConfigured?"Ready for worker verification":"No Instagram session saved"}</small></span></div>
      <div className="instagram-connection-actions"><button type="button" onClick={openInstagramLogin} disabled={!extensionReady}>Open Instagram login</button><button type="button" onClick={connectInstagram} disabled={!extensionReady||connecting}>{connecting?"Connecting…":connection?.sessionIdConfigured||connection?.settingsConfigured?"Reconnect signed-in account":"Connect signed-in account"}</button></div>
    </section>

    <section className="story-today">
      <div className="story-section-title"><div><span>Today’s batch</span><h3>Instagram Stories</h3></div><button type="button" onClick={()=>void refreshStories()}><RefreshCw/>Refresh</button></div>
      {jobs.length?<div className="story-job-grid">{jobs.map((job,index)=><article key={job.id} className={`story-job ${job.status}`}><span>{String(index+1).padStart(2,"0")}</span><div><b>{job.drama_title}</b><small>{job.selection_source==="daily_post"?"Today’s Post":"Library rotation"}</small></div><time>{new Date(job.scheduled_at).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})}</time><em>{storyStatus(job)}</em>{job.error&&<p>{job.error}</p>}</article>)}</div>:<div className="story-empty-plan"><Clock3/><div><b>{loadingJobs?"Loading today’s plan…":"Today’s plan has not run yet"}</b><p>The Story worker creates one morning batch automatically. No manual caption or scheduling is required.</p></div></div>}
    </section>

    <div className="poster-workspace">
      <aside className="poster-source-panel"><div className="poster-source-head"><div><b>Story library</b><small>{eligibleCount} eligible published dramas</small></div><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search title or code" aria-label="Search dramas"/></label></div>
        <div className="poster-list" aria-label="Drama poster list">{visibleSources.map(item=>{const eligible=storyEligible(item);return <article className={`poster-list-row${source?.id===item.id?" selected":""}`} key={item.id}><button className="poster-list-main" type="button" onClick={()=>setSourceId(item.id)}><img src={item.coverUrl} alt=""/><span><b>{item.title}</b><small>Content Code · {item.contentCode}</small><em className={eligible?"saved":""}>{eligible?"Ready for Story rotation":"Missing ReelShort link"}</em></span></button><span className="story-library-state">{jobs.some(job=>job.drama_slug===item.slug)?"In today’s batch":eligible?"Eligible":"Unavailable"}</span></article>})}{!visibleSources.length&&<p className="poster-no-results">No dramas match this search.</p>}</div>
      </aside>
      <div className="poster-editor">
        <div className="poster-preview-card"><div className="poster-preview-title"><span>Story preview</span><b>1080 × 1920 JPG</b></div><div className="poster-preview-wrap story-ratio">{previewError&&<div className="poster-preview-error"><AlertCircle/><span>{previewError}</span></div>}<canvas ref={canvasRef} aria-label="Generated Story poster preview"/></div><button className="poster-download" type="button" onClick={()=>void downloadCurrent()} disabled={Boolean(previewError)}><Download/>Download Story poster</button></div>
        <div className="story-details"><span>Selected drama</span><h3>{source.title}</h3><dl><div><dt>Content Code</dt><dd>{source.contentCode}</dd></div><div><dt>Story eligibility</dt><dd>{storyEligible(source)&&<Check/>}{storyEligible(source)?"Ready":"Missing ReelShort link"}</dd></div><div><dt>Rotation rule</dt><dd>7-day cooldown</dd></div></dl><div className="story-direct-link"><Link2/><div><b>Direct ReelShort Link Sticker</b>{storyEligible(source)?<a href={source.contentPromotionUrl} target="_blank" rel="noreferrer">{source.contentPromotionUrl}<ExternalLink/></a>:<small>Add a reelslink.com promotion URL to enable this drama.</small>}<small>No caption and no DramaClips redirect.</small></div></div><p>After this drama is published as a Story, it returns to the library automatically when its cooldown ends. It never needs to become a Post again.</p></div>
      </div>
    </div>
    {message&&<p className={`poster-message ${message.kind}`} role="status">{message.kind==="success"?<Check/>:<AlertCircle/>}{message.text}</p>}
  </section>;
}
