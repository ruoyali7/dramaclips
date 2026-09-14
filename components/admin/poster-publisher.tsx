"use client";

import { AlertCircle, Check, ChevronDown, Copy, Download, RefreshCw, Save, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PosterSource = { id:string; title:string; slug:string; contentCode:string; coverUrl:string; description:string; tags:string[]; contentPromotionUrl:string };
type CoverPost = { id:string; drama_slug:string; platform:"facebook"|"instagram"; image_url:string; content_code:string; caption:string; status:string; created_at:string; updated_at:string };
type Editor = { facebook:string; instagram:string };
type Operation = "loading"|"download"|"batch"|"save-facebook"|"save-instagram"|"copy-facebook"|"copy-instagram"|null;

function hashtags(tags:string[]){return [...tags.slice(0,3).map(tag=>`#${tag.toLowerCase().replace(/[^a-z0-9]+/g,"")}`).filter(tag=>tag.length>1),"#shortdrama","#dramaclips"].join(" ")}
function defaultEditor(source:PosterSource):Editor { const tags=hashtags(source.tags); return {
  facebook:`${source.description}\n\n🎬 Watch this drama on ReelShort: ${source.contentPromotionUrl}\n🔍 Search Content Code: ${source.contentCode}\n\n${tags}`,
  instagram:`${source.description}\n\nContinue watching through the link in bio.\n🔍 Content Code: ${source.contentCode}\n\n${tags}`
}; }

function drawPoster(canvas:HTMLCanvasElement,image:HTMLImageElement,code:string){
  const width=1080,height=1350; canvas.width=width;canvas.height=height;
  const context=canvas.getContext("2d");if(!context)return;
  const scale=Math.max(width/image.naturalWidth,height/image.naturalHeight),imageWidth=image.naturalWidth*scale,imageHeight=image.naturalHeight*scale;
  context.drawImage(image,(width-imageWidth)/2,(height-imageHeight)/2,imageWidth,imageHeight);
  const label=`CONTENT CODE · ${code}`;context.font="700 30px Arial, sans-serif";const labelWidth=context.measureText(label).width+48;
  context.fillStyle="rgba(0, 0, 0, 0.76)";context.fillRect(34,34,labelWidth,66);context.fillStyle="#fff";context.fillText(label,58,75);
}

function loadImage(url:string){return new Promise<HTMLImageElement>((resolve,reject)=>{const image=new Image();image.crossOrigin="anonymous";image.onload=()=>resolve(image);image.onerror=()=>reject(new Error("The cover could not be loaded. Check its R2 URL."));image.src=url;if(image.complete&&image.naturalWidth)resolve(image);});}
function saveCanvas(canvas:HTMLCanvasElement,name:string){return new Promise<void>((resolve,reject)=>canvas.toBlob(blob=>{if(!blob){reject(new Error("The poster could not be generated."));return;}const url=URL.createObjectURL(blob),link=document.createElement("a");link.download=name;link.href=url;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),1000);resolve();},"image/png"));}

export function PosterPublisher({sources}:{sources:PosterSource[]}){
  const [sourceId,setSourceId]=useState(sources[0]?.id||"");
  const [editors,setEditors]=useState<Record<string,Editor>>(()=>Object.fromEntries(sources.map(source=>[source.id,defaultEditor(source)])));
  const [savedPosts,setSavedPosts]=useState<CoverPost[]>([]);
  const [selectedIds,setSelectedIds]=useState<string[]>(sources.slice(0,1).map(item=>item.id));
  const [query,setQuery]=useState("");
  const [operation,setOperation]=useState<Operation>("loading");
  const [message,setMessage]=useState<{kind:"success"|"error";text:string}|null>(null);
  const [previewError,setPreviewError]=useState("");
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const source=sources.find(item=>item.id===sourceId)||sources[0];
  const editor=source?editors[source.id]||defaultEditor(source):null;
  const visibleSources=useMemo(()=>sources.filter(item=>`${item.title} ${item.contentCode}`.toLowerCase().includes(query.trim().toLowerCase())),[sources,query]);
  const draftedSlugs=useMemo(()=>new Set(savedPosts.map(post=>post.drama_slug)),[savedPosts]);

  async function refreshDrafts(){const response=await fetch("/api/admin/cover-posts");if(!response.ok)throw new Error("Saved drafts could not be loaded.");const result=await response.json();setSavedPosts(result.posts||[]);}
  useEffect(()=>{void refreshDrafts().catch(error=>setMessage({kind:"error",text:error instanceof Error?error.message:"Saved drafts could not be loaded."})).finally(()=>setOperation(null));},[]);
  useEffect(()=>{if(!source||!canvasRef.current)return;let active=true;setPreviewError("");void loadImage(source.coverUrl).then(image=>{if(active&&canvasRef.current)drawPoster(canvasRef.current,image,source.contentCode)}).catch(error=>{if(active)setPreviewError(error instanceof Error?error.message:"The cover could not be loaded.")});return()=>{active=false};},[source]);

  function updateCaption(platform:keyof Editor,value:string){if(!source)return;setEditors(current=>({...current,[source.id]:{...(current[source.id]||defaultEditor(source)),[platform]:value}}));}
  function resetCurrent(){if(!source)return;setEditors(current=>({...current,[source.id]:defaultEditor(source)}));setMessage({kind:"success",text:`${source.title} captions reset from its saved drama details.`});}
  function generateCurrent(){resetCurrent();setMessage({kind:"success",text:"Captions regenerated from the drama description, Content Code, and promotion link."});}
  async function downloadSource(item:PosterSource){setOperation("download");setMessage(null);try{const image=await loadImage(item.coverUrl),canvas=document.createElement("canvas");drawPoster(canvas,image,item.contentCode);await saveCanvas(canvas,`${item.slug}-poster.png`);setMessage({kind:"success",text:`${item.title} poster downloaded.`});}catch(error){setMessage({kind:"error",text:error instanceof Error?error.message:"The poster could not be downloaded."});}finally{setOperation(null);}}
  async function downloadCurrent(){if(!source||!canvasRef.current)return;setOperation("download");setMessage(null);try{await saveCanvas(canvasRef.current,`${source.slug}-poster.png`);setMessage({kind:"success",text:`${source.title} poster downloaded.`});}catch(error){setMessage({kind:"error",text:error instanceof Error?error.message:"The poster could not be downloaded."});}finally{setOperation(null);}}
  async function downloadBatch(){const selected=sources.filter(item=>selectedIds.includes(item.id));setOperation("batch");setMessage(null);const failures:string[]=[];for(const item of selected){try{const image=await loadImage(item.coverUrl),canvas=document.createElement("canvas");drawPoster(canvas,image,item.contentCode);await saveCanvas(canvas,`${item.slug}-poster.png`);await new Promise(resolve=>window.setTimeout(resolve,180));}catch{failures.push(item.title);}}setOperation(null);setMessage(failures.length?{kind:"error",text:`Downloaded ${selected.length-failures.length} of ${selected.length}. Retry: ${failures.join(", ")}.`}:{kind:"success",text:`Downloaded ${selected.length} poster${selected.length===1?"":"s"}.`});}
  async function copyCaption(platform:keyof Editor){if(!editor)return;setOperation(platform==="facebook"?"copy-facebook":"copy-instagram");setMessage(null);try{await navigator.clipboard.writeText(editor[platform]);setMessage({kind:"success",text:`${platform==="facebook"?"Facebook":"Instagram"} caption copied.`});}catch{setMessage({kind:"error",text:"Clipboard access was blocked. Select and copy the caption manually."});}finally{window.setTimeout(()=>setOperation(null),700);}}
  async function saveDraft(platform:keyof Editor){if(!source||!editor)return;setOperation(platform==="facebook"?"save-facebook":"save-instagram");setMessage(null);try{const existing=savedPosts.find(post=>post.drama_slug===source.slug&&post.platform===platform);const response=await fetch("/api/admin/cover-posts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:existing?.id,dramaSlug:source.slug,platform,imageUrl:source.coverUrl,contentCode:source.contentCode,caption:editor[platform]})});const result=await response.json();if(!response.ok)throw new Error(result.message||"The draft could not be saved.");await refreshDrafts();setMessage({kind:"success",text:`${platform==="facebook"?"Facebook":"Instagram"} draft ${existing?"updated":"saved"}.`});}catch(error){setMessage({kind:"error",text:error instanceof Error?error.message:"The draft could not be saved."});}finally{setOperation(null);}}
  function openDraft(post:CoverPost){const next=sources.find(item=>item.slug===post.drama_slug);if(!next)return;setSourceId(next.id);setEditors(current=>({...current,[next.id]:{...(current[next.id]||defaultEditor(next)),[post.platform]:post.caption}}));setMessage({kind:"success",text:`Opened the ${post.platform} draft for editing.`});}

  if(!sources.length)return <section className="poster-empty"><h2>No published dramas</h2><p>Publish a drama before creating poster assets.</p></section>;
  return <section className="poster-publisher" aria-labelledby="poster-publisher-title">
    <header className="poster-publisher-head"><div><span>02 · Poster assets</span><h2 id="poster-publisher-title">Prepare a cover and caption</h2><p>Create platform-ready assets, then download and publish them manually.</p></div><button type="button" onClick={resetCurrent}><RefreshCw/> Reset current</button></header>
    <div className="poster-workspace">
      <aside className="poster-source-panel"><div className="poster-source-head"><div><b>Drama library</b><small>{sources.length} published dramas</small></div><label><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search title or code" aria-label="Search dramas"/></label></div>
        <div className="poster-list" aria-label="Drama cover list">{visibleSources.map(item=>{const selected=source?.id===item.id,drafted=draftedSlugs.has(item.slug);return <article className={`poster-list-row${selected?" selected":""}`} key={item.id}>
          <input aria-label={`Select ${item.title}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={event=>setSelectedIds(current=>event.target.checked?Array.from(new Set([...current,item.id])):current.filter(id=>id!==item.id))}/>
          <button className="poster-list-main" type="button" onClick={()=>setSourceId(item.id)}><img src={item.coverUrl} alt=""/><span><b>{item.title}</b><small>Content Code · {item.contentCode}</small><em className={drafted?"saved":""}>{drafted?"Draft saved":"No draft"}</em></span></button>
          <button className="poster-row-download" type="button" onClick={()=>void downloadSource(item)} disabled={operation!==null} title={`Download ${item.title} poster`}><Download/><span>Download</span></button>
          <button className="poster-row-caption" type="button" onClick={()=>{setSourceId(item.id);setEditors(current=>({...current,[item.id]:defaultEditor(item)}));setMessage({kind:"success",text:`Captions regenerated for ${item.title}.`});}}>Generate captions</button>
        </article>})}{visibleSources.length===0&&<p className="poster-no-results">No dramas match this search.</p>}</div>
        <div className="poster-list-toolbar"><span>{selectedIds.length} selected</span><div><button type="button" onClick={()=>setSelectedIds(sources.map(item=>item.id))}>Select all</button><button type="button" onClick={()=>setSelectedIds([])}>Clear</button></div><button className="poster-download" type="button" onClick={()=>void downloadBatch()} disabled={operation!==null||selectedIds.length===0}><Download/>{operation==="batch"?"Preparing…":`Download selected (${selectedIds.length})`}</button></div>
      </aside>
      <div className="poster-editor">
        <div className="poster-preview-card"><div className="poster-preview-title"><span>Poster preview</span><b>1080 × 1350 PNG</b></div><div className="poster-preview-wrap">{previewError&&<div className="poster-preview-error"><AlertCircle/><span>{previewError}</span></div>}<canvas ref={canvasRef} aria-label="Generated poster preview"/></div><button className="poster-download" type="button" onClick={()=>void downloadCurrent()} disabled={operation!==null||Boolean(previewError)}><Download/>Download PNG</button></div>
        <div className="poster-publisher-form"><div className="poster-editor-title"><div><span>Editing</span><h3>{source.title}</h3></div><button type="button" onClick={generateCurrent}><RefreshCw/>Regenerate captions</button></div>
          <label><b>Content Code</b><input value={source.contentCode} readOnly/><small>Uses the verified code saved with this drama.</small></label>
          {(["facebook","instagram"] as const).map(platform=><section className="poster-caption-card" key={platform}><div><span>{platform}</span><small>{editor?.[platform].length||0} characters</small></div><textarea value={editor?.[platform]||""} onChange={event=>updateCaption(platform,event.target.value)} aria-label={`${platform} caption`}/><div><button className="poster-copy" type="button" onClick={()=>void copyCaption(platform)} disabled={operation!==null}>{operation===`copy-${platform}`?<Check/>:<Copy/>}{operation===`copy-${platform}`?"Copied":"Copy caption"}</button><button className="poster-save" type="button" onClick={()=>void saveDraft(platform)} disabled={operation!==null}><Save/>{operation===`save-${platform}`?"Saving…":savedPosts.some(post=>post.drama_slug===source.slug&&post.platform===platform)?"Update draft":"Save draft"}</button></div></section>)}
        </div>
      </div>
    </div>
    {message&&<p className={`poster-message ${message.kind}`} role="status">{message.kind==="success"?<Check/>:<AlertCircle/>}{message.text}</p>}
    <details className="poster-saved"><summary><span><b>Poster drafts</b><small>Reopen saved caption work · {savedPosts.length} drafts</small></span><ChevronDown/></summary><div>{savedPosts.map(post=><button type="button" key={post.id} onClick={()=>openDraft(post)}><span><b>{sources.find(item=>item.slug===post.drama_slug)?.title||post.drama_slug}</b><small>{post.platform} · Content Code {post.content_code}</small></span><time>{new Date(post.updated_at||post.created_at).toLocaleDateString()}</time></button>)}{savedPosts.length===0&&<p>No drafts saved yet.</p>}</div></details>
  </section>;
}
