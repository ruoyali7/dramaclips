"use client";

import { Download, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type PosterSource = { id: string; title: string; slug: string; publicCode: string; coverUrl: string };
type CoverPost = { id: string; drama_slug: string; platform: string; content_code: string; status: string; created_at: string };

function drawPoster(canvas: HTMLCanvasElement, image: HTMLImageElement, code: string) {
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const imageWidth = image.naturalWidth * scale;
  const imageHeight = image.naturalHeight * scale;
  context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
  const label = code.trim() || "CONTENT CODE";
  context.font = "700 30px Arial, sans-serif";
  const paddingX = 24;
  const paddingY = 18;
  const labelWidth = context.measureText(label).width + paddingX * 2;
  context.fillStyle = "rgba(0, 0, 0, 0.72)";
  context.fillRect(34, 34, labelWidth, 66);
  context.fillStyle = "#fff";
  context.fillText(label, 34 + paddingX, 34 + paddingY + 23);
}

export function PosterPublisher({ sources }: { sources: PosterSource[] }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id || "");
  const [code, setCode] = useState(sources[0]?.publicCode || "");
  const [facebookCaption, setFacebookCaption] = useState("");
  const [instagramCaption, setInstagramCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [savedPosts, setSavedPosts] = useState<CoverPost[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>(sources.slice(0, 1).map((item) => item.id));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const source = sources.find((item) => item.id === sourceId) || sources[0];
  const generatedIds = new Set(savedPosts.map((post) => sources.find((item) => item.slug === post.drama_slug)?.id).filter(Boolean) as string[]);
  useEffect(() => { void fetch("/api/admin/cover-posts").then((response) => response.ok ? response.json() : null).then((result) => setSavedPosts(result?.posts || [])).catch(() => null); }, []);
  const image = useMemo(() => {
    if (!source?.coverUrl) return null;
    const value = new Image();
    value.crossOrigin = "anonymous";
    value.src = source.coverUrl;
    return value;
  }, [source?.coverUrl]);

  useEffect(() => {
    if (!source) return;
    setCode(source.publicCode || "");
    setFacebookCaption(`Everyone thought this story was over. They were wrong.\n\nContinue watching on DramaClips.\n#shortdrama #dramaclips`);
    setInstagramCaption(`A story full of secrets, betrayal, and one impossible choice.\n\nContinue watching on DramaClips.\n#shortdrama #dramaclips`);
  }, [source?.id]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const render = () => drawPoster(canvasRef.current!, image, code);
    image.complete ? render() : image.addEventListener("load", render, { once: true });
    return () => image.removeEventListener("load", render);
  }, [image, code]);

  function selectSource(value: string) {
    setSourceId(value);
    const next = sources.find((item) => item.id === value);
    if (next) setCode(next.publicCode || "");
  }

  function download() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${source?.slug || "drama"}-poster.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  async function downloadBatch() {
    const selected = sources.filter((item) => selectedIds.includes(item.id));
    setBusy(true); setMessage("");
    try {
      for (const item of selected) {
        const image = new Image(); image.crossOrigin = "anonymous"; image.src = item.coverUrl;
        await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error(`Could not load cover for ${item.title}`)); });
        const canvas = document.createElement("canvas"); drawPoster(canvas, image, item.publicCode);
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error(`Could not generate poster for ${item.title}`);
        const link = document.createElement("a"); link.download = `${item.slug}-poster.png`; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      setMessage(`${selected.length} poster${selected.length === 1 ? "" : "s"} downloaded.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not download posters"); }
    finally { setBusy(false); }
  }

  async function copy(value: string) {
    setBusy(true);
    await navigator.clipboard.writeText(value);
    window.setTimeout(() => setBusy(false), 700);
  }

  async function saveDraft(platform: "facebook" | "instagram", caption: string) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/cover-posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dramaSlug: source?.slug, platform, imageUrl: source?.coverUrl, contentCode: code, caption }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not save draft");
      setMessage(`${platform === "facebook" ? "Facebook" : "Instagram"} cover draft saved.`);
      const refreshed = await fetch("/api/admin/cover-posts");
      if (refreshed.ok) setSavedPosts((await refreshed.json()).posts || []);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save draft"); }
    finally { setBusy(false); }
  }

  if (!sources.length) return null;
  return (
    <section className="poster-publisher" aria-labelledby="poster-publisher-title">
      <div className="poster-publisher-head">
        <div><span>02 · Poster publishing</span><h2 id="poster-publisher-title">Edit a cover into a post</h2><p>Use the original R2 cover and add a clear content code in the top-left corner.</p></div>
        <button type="button" onClick={() => { setSourceId(sources[0].id); setCode(sources[0].publicCode || ""); }}><RefreshCw /> Reset</button>
      </div>
      <div className="poster-list" aria-label="Drama cover list">
        {sources.map((item) => {
          const generated = generatedIds.has(item.id);
          return <article className={`poster-list-row${source?.id === item.id ? " selected" : ""}`} key={item.id}>
            <input aria-label={`Select ${item.title}`} type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
            <button className="poster-list-cover" type="button" onClick={() => selectSource(item.id)}><img src={item.coverUrl} alt="" /><span>{generated ? "Generated" : "Not generated"}</span></button>
            <div className="poster-list-copy"><b>{item.title}</b><small>Code · {item.publicCode}</small></div>
            <button className="poster-list-action" type="button" onClick={() => { selectSource(item.id); window.setTimeout(download, 0); setMessage(generated ? `${item.title} poster downloaded.` : `${item.title} poster generated and downloaded.`); }} title={generated ? "Download poster" : "Generate poster"}>{generated ? <Download /> : "Generate"}</button>
            <button className="poster-list-caption" type="button" onClick={() => { selectSource(item.id); setMessage("Captions generated below."); }}>Generate captions</button>
          </article>;
        })}
      </div>
      <div className="poster-list-toolbar"><button className="poster-download" type="button" onClick={() => void downloadBatch()} disabled={busy || selectedIds.length === 0}><Download /> Download selected PNGs ({selectedIds.length})</button></div>
      <div className="poster-publisher-grid">
        <div className="poster-preview-wrap"><canvas ref={canvasRef} aria-label="Generated poster preview" /></div>
        <div className="poster-publisher-form">
          <label><b>Cover</b><select value={source?.id} onChange={(event) => selectSource(event.target.value)}>{sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <fieldset className="poster-batch-select"><legend>Manual upload selection</legend><div className="poster-batch-actions"><button type="button" onClick={() => setSelectedIds(sources.map((item) => item.id))}>Select all</button><button type="button" onClick={() => setSelectedIds([])}>Clear</button></div>{sources.map((item) => <label key={item.id}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} /> {item.title}</label>)}<button className="poster-copy" type="button" onClick={() => void downloadBatch()} disabled={busy || selectedIds.length === 0}>Download selected PNGs ({selectedIds.length})</button></fieldset>
          <label><b>Top-left code</b><input value={code} onChange={(event) => setCode(event.target.value)} maxLength={40} placeholder="CONTENT CODE" /><small>White text on a semi-transparent black label.</small></label>
          <button className="poster-download" type="button" onClick={download}><Download /> Download generated poster</button>
          <label><b>Facebook caption</b><textarea value={facebookCaption} onChange={(event) => setFacebookCaption(event.target.value)} /></label>
          <button className="poster-copy" type="button" onClick={() => void copy(facebookCaption)}>{busy ? "Copied" : "Copy Facebook caption"}</button>
          <button className="poster-copy" type="button" onClick={() => void saveDraft("facebook", facebookCaption)} disabled={busy}><Save /> Save Facebook draft</button>
          <label><b>Instagram caption</b><textarea value={instagramCaption} onChange={(event) => setInstagramCaption(event.target.value)} /></label>
          <button className="poster-copy" type="button" onClick={() => void copy(instagramCaption)}>{busy ? "Copied" : "Copy Instagram caption"}</button>
          <button className="poster-copy" type="button" onClick={() => void saveDraft("instagram", instagramCaption)} disabled={busy}><Save /> Save Instagram draft</button>
          {message && <p className="poster-message">{message}</p>}
          {savedPosts.filter((post) => post.drama_slug === source?.slug).length > 0 && <div className="poster-saved"><b>Saved drafts for this drama</b>{savedPosts.filter((post) => post.drama_slug === source?.slug).slice(0, 4).map((post) => <span key={post.id}>{post.platform} · {post.status} · {new Date(post.created_at).toLocaleDateString()}</span>)}</div>}
        </div>
      </div>
    </section>
  );
}
