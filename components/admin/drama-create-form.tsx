"use client";

import { CheckCircle2, CloudUpload, ExternalLink, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { isReadyDramaVideo, nextEpisodeNumber } from "@/lib/drama-onboarding";

type EpisodeRow = { episodeNumber: number; videoUrl: string; name?: string; progress?: number; status?: string };
type EditableDrama = { id: string; title: string; slug: string; publicCode: string; promoCode: string; language: string; tags: string[]; description: string; coverUrl: string; episodes: Array<{episodeNumber:number;videoUrl:string}>; hasCpsUrl: boolean; hasAppCpsUrl: boolean };
const initial: EpisodeRow[] = [1, 2, 3, 4, 5].map((episodeNumber) => ({ episodeNumber, videoUrl: "" }));
const acceptedTypes = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/3gpp"]);

function naturalFiles(files: File[]) {
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
}

const remoteVideoHosts = new Set(["v-mps.crazymaplestudios.com", "v-out.oss-accelerate.aliyuncs.com"]);
function isRemoteVideoUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && remoteVideoHosts.has(url.hostname) && url.pathname.toLowerCase().endsWith(".mp4");
  } catch { return false; }
}

function uploadFile(file: File, uploadUrl: string, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("R2 upload failed. Check the bucket CORS policy."));
    xhr.send(file);
  });
}

export function DramaCreateForm({ r2DashboardUrl, initialDrama, r2PublicBase }: { r2DashboardUrl: string; initialDrama?: EditableDrama; r2PublicBase?: string }) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialDrama?.episodes || initial);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverStatus, setCoverStatus] = useState("");
  const [coverProgress, setCoverProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ id: string; title: string; episodeCount: number; changedEpisodes?: number[]; queueEpisodeNumbers?: number[]; vizard?: { status: "queued" | "failed"; requested: number; accepted: number; message?: string } } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [rsLink, setRsLink] = useState("");
  const [rsImporting, setRsImporting] = useState(false);
  const [rsExtensionReady, setRsExtensionReady] = useState(false);
  const [rsNotice, setRsNotice] = useState("");
  const [remoteLinks, setRemoteLinks] = useState("");
  const slugRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;
  const readyCount = episodes.filter(episode => isReadyDramaVideo(episode.videoUrl, r2PublicBase)).length;
  const fieldMessage = (name: string) => fieldErrors[name]?.length ? <small className="field-error" role="alert">{fieldErrors[name].join(" · ")}</small> : null;

  useEffect(() => {
    if (!rsImporting) return;
    const timer = window.setTimeout(() => {setRsImporting(false);setRsNotice("");setError("RS import timed out. Check the extension and try again.");}, 45000);
    return () => window.clearTimeout(timer);
  }, [rsImporting]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== window || !event.data || event.data.source !== "dramaclips-rs-extension") return;
      if (event.data.type === "RS_EXTENSION_READY") { setRsExtensionReady(true); return; }
      if (event.data.type === "RS_IMPORT_ERROR") { setRsImporting(false); setError(String(event.data.message || "RS Boost import failed")); return; }
      if (event.data.type !== "RS_IMPORT_RESULT" || typeof event.data.text !== "string" || typeof event.data.url !== "string") return;
      void importCapturedRs(event.data.url, event.data.text, Array.isArray(event.data.videos) ? event.data.videos : []);
    }
    window.addEventListener("message", receive);
    window.postMessage({ source: "dramaclips", type: "RS_EXTENSION_PING" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  async function importCapturedRs(link: string, detailsText: string, capturedVideos: unknown[]) {
    setError(""); setRsNotice("Reading captured drama details…");
    try {
      const response = await fetch("/api/admin/rs-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link, detailsText }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not read RS Boost details");
      const drama = result.drama as Record<string, unknown>;
      const currentTitle = (formRef.current?.elements.namedItem("title") as HTMLInputElement | null)?.value;
      if ((currentTitle || episodesRef.current.some((episode) => episode.videoUrl || episode.name)) && !window.confirm("Replace existing drama details and episode list with this RS import? Uploaded R2 files will be kept.")) {setRsNotice("Import canceled. Existing content kept.");return;}
      for (const name of ["title", "slug", "language", "description", "coverUrl", "cpsUrl", "appCpsUrl"] as const) {
        const value = drama[name];
        const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (field && typeof value === "string" && value) field.value = value;
      }
      const promoCode = formRef.current?.elements.namedItem("promoCode") as HTMLInputElement | null;
      if (promoCode && typeof (drama.promoCode || drama.publicCode) === "string") promoCode.value = String(drama.promoCode || drama.publicCode);
      const tags = formRef.current?.elements.namedItem("tags") as HTMLInputElement | null;
      if (tags && Array.isArray(drama.tags)) tags.value = drama.tags.join(", ");
      const videos = capturedVideos.flatMap((value) => {
        if (!value || typeof value !== "object") return [];
        const item = value as Record<string, unknown>;
        const episodeNumber = Number(item.episodeNumber);
        return Number.isInteger(episodeNumber) && episodeNumber > 0 && episodeNumber <= 100 && typeof item.url === "string" && isRemoteVideoUrl(item.url) ? [{ episodeNumber, url: item.url }] : [];
      });
      setRsLink(link);
      if (videos.length) {
        setRsNotice(`Imported details · transferring ${videos.length} free video${videos.length === 1 ? "" : "s"} to R2…`);
        const failures = await transferRemoteEpisodes(videos.map(({ episodeNumber, url }) => ({ episodeNumber, videoUrl: url, name: `RS free EP ${episodeNumber}`, progress: 0, status: "Ready to transfer" })));
        setRsNotice(`Imported${drama.chapterCount ? ` · ${drama.chapterCount} total episodes` : ""} · ${videos.length - failures.length}/${videos.length} free previews ready in R2. Review before saving.`);
      } else {
        if (typeof drama.freeChapterCount === "number" && drama.freeChapterCount > 0 && drama.freeChapterCount <= 100 && episodesRef.current.every((episode) => !episode.videoUrl && !episode.name)) setEpisodes(Array.from({ length: drama.freeChapterCount }, (_, index) => ({ episodeNumber: index + 1, videoUrl: "" })));
        setRsNotice(`Imported details, but RS returned no supported free MP4 videos. Review before saving.`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "RS Boost import failed"); setRsNotice("");
    } finally { setRsImporting(false); }
  }

  function startRsImport() {
    try {
      const url = new URL(rsLink.trim());
      if (url.protocol !== "https:" || url.hostname !== "cps.reelshort.com" || !/^\/resource-square\/detail\/[a-f0-9]+$/i.test(url.pathname)) throw new Error();
      if (!rsExtensionReady) { setError("Install or enable the DramaClips RS Importer Chrome extension, then refresh this page."); return; }
      setError(""); setRsNotice("Opening the signed-in RS Boost page…"); setRsImporting(true);
      window.postMessage({ source: "dramaclips", type: "RS_IMPORT_REQUEST", url: url.toString() }, window.location.origin);
    } catch { setError("Paste a valid cps.reelshort.com resource detail link."); }
  }

  function patchEpisode(index: number, patch: Partial<EpisodeRow>) {
    setEpisodes((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function fillRemoteLinks() {
    const links = remoteLinks.split(/\s+/).map((value) => value.trim()).filter(Boolean);
    if (!links.length) { setError("Paste at least one video URL."); return; }
    if (links.length > 100) { setError("Paste up to 100 video URLs at a time."); return; }
    try {
      for (const link of links) {
        const url = new URL(link);
        if (!isRemoteVideoUrl(link)) throw new Error();
      }
    } catch {
      setError("Every URL must be an HTTPS MP4 link from an approved source host.");
      return;
    }
    setError("");
    if (episodes.some(episode => episode.videoUrl || episode.name) && !window.confirm("Replace the current episode list? Uploaded R2 files will be kept.")) return;
    setSelectedFiles([]);
    setEpisodes(links.map((videoUrl, index) => ({ episodeNumber: index + 1, videoUrl, name: `Remote EP ${index + 1}`, progress: 0, status: "Ready to transfer" })));
  }

  async function uploadRemoteLinks() {
    if (uploading) return;
    const pending = episodes.map((episode, index) => ({ episode, index })).filter(({ episode }) => isRemoteVideoUrl(episode.videoUrl) && episode.status !== "Ready");
    if (!pending.length) { setError("Fill the episode list with source video links first."); return; }
    await transferRemoteEpisodes(episodes);
  }

  async function transferRemoteEpisodes(rows: EpisodeRow[]) {
    const slug = slugRef.current?.value.trim() || "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError("Enter a valid slug before transferring videos to R2."); slugRef.current?.focus(); return rows.filter((episode) => isRemoteVideoUrl(episode.videoUrl)); }
    const pending = rows.map((episode, index) => ({ episode, index })).filter(({ episode }) => isRemoteVideoUrl(episode.videoUrl) && episode.status !== "Ready");
    setEpisodes(rows);
    setError(""); setUploading(true);
    const failures: string[] = [];
    const worker = async () => {
      while (pending.length) {
        const { episode, index } = pending.shift()!;
        patchEpisode(index, { status: "Transferring", progress: 20 });
        try {
          const response = await fetch("/api/admin/uploads/remote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: episode.videoUrl, slug, episodeNumber: episode.episodeNumber }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || "Remote transfer failed");
          patchEpisode(index, { videoUrl: result.publicUrl, status: "Ready", progress: 100 });
        } catch (reason) {
          failures.push(`EP ${episode.episodeNumber}: ${reason instanceof Error ? reason.message : "Transfer failed"}`);
          patchEpisode(index, { status: "Failed", progress: 0 });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    setUploading(false);
    if (failures.length) setError(failures.join(" · "));
    return failures;
  }

  function selectFiles(filesInput: FileList | null) {
    if (!filesInput?.length || uploading) return;
    const files = naturalFiles(Array.from(filesInput));
    const invalid = files.find((file) => !acceptedTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 ** 3);
    if (invalid) {
      setError(`${invalid.name} is not a supported video or exceeds 10 GB.`);
      return;
    }
    if (files.length > 100) {
      setError("A preview bundle can contain up to 100 episodes.");
      return;
    }
    setError("");
    if (episodes.some(episode => episode.videoUrl || episode.name) && !window.confirm("Replace the current episode list with these files? Uploaded R2 files will be kept.")) return;
    setSelectedFiles(files);
    setEpisodes(files.map((file, index) => ({ episodeNumber: index + 1, videoUrl: "", name: file.name, progress: 0, status: "Queued" })));
  }

  async function uploadSelected() {
    if (!selectedFiles.length || uploading) return;
    const slug = slugRef.current?.value.trim() || "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError("Enter a valid slug before uploading episode files.");
      slugRef.current?.focus();
      return;
    }
    setError("");
    setUploading(true);
    const failures: string[] = [];
    for (let index = 0; index < selectedFiles.length; index += 1) {
      if (episodes[index]?.status === "Ready") continue;
      const file = selectedFiles[index];
      try {
        patchEpisode(index, { status: "Preparing", progress: 0 });
        const response = await fetch("/api/admin/uploads/presign", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fileName: file.name, contentType: file.type, size: file.size, slug }),
        });
        const prepared = await response.json();
        if (!response.ok) throw new Error(prepared.message || "Could not prepare R2 upload");
        patchEpisode(index, { status: "Uploading" });
        await uploadFile(file, prepared.uploadUrl, (progress) => patchEpisode(index, { progress }));
        patchEpisode(index, { videoUrl: prepared.publicUrl, progress: 100, status: "Ready" });
      } catch (uploadError) {
        failures.push(file.name);
        patchEpisode(index, { status: "Failed" });
      }
    }
    setUploading(false);
    if (failures.length) setError(`${failures.length} upload${failures.length > 1 ? "s" : ""} failed. Check R2/CORS and click Retry failed uploads.`);
    else setSelectedFiles([]);
  }

  function removeEpisode(index: number) {
    setEpisodes((rows) => rows.filter((_, rowIndex) => rowIndex !== index));
    setSelectedFiles((files) => files.filter((_, fileIndex) => fileIndex !== index));
  }

  function selectCover(file: File | undefined) {
    if (!file || uploading) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size <= 0 || file.size > 20 * 1024 ** 2) {
      setError(`${file.name} is not a JPG, PNG, or WebP image under 20 MB.`);
      return;
    }
    setError("");
    setCoverFile(file);
    setCoverStatus("Queued");
    setCoverProgress(0);
  }

  async function uploadCover() {
    if (!coverFile || uploading) return;
    const slug = slugRef.current?.value.trim() || "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError("Enter a valid slug before uploading the cover.");
      slugRef.current?.focus();
      return;
    }
    setUploading(true); setError(""); setCoverStatus("Preparing");
    try {
      const response = await fetch("/api/admin/uploads/presign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fileName: coverFile.name, contentType: coverFile.type, size: coverFile.size, slug, kind: "cover" }) });
      const prepared = await response.json();
      if (!response.ok) throw new Error(prepared.message || "Could not prepare cover upload");
      setCoverStatus("Uploading");
      await uploadFile(coverFile, prepared.uploadUrl, setCoverProgress);
      if (coverRef.current) coverRef.current.value = prepared.publicUrl;
      setCoverProgress(100); setCoverStatus("Ready · editable"); setCoverFile(null);
    } catch (uploadError) {
      setCoverStatus("Failed");
      setError(uploadError instanceof Error ? uploadError.message : "Cover upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading || saving || (!initialDrama && result)) return;
    if (readyCount !== episodes.length || coverFile || selectedFiles.length) {setError("Finish R2 uploads before publishing. Every episode must have a ready R2 URL.");setFieldErrors({episodes:["Transfer or upload every episode to R2 first."]});return;}
    setSaving(true);
    setError("");
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const cpsUrl = String(form.get("cpsUrl") || "").trim();
    const appCpsUrl = String(form.get("appCpsUrl") || "").trim();
    const body = {
      title: form.get("title"), slug: form.get("slug"), publicCode: form.get("promoCode"), promoCode: form.get("promoCode"),
      language: form.get("language"), tags: String(form.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
      description: form.get("description"), coverUrl: form.get("coverUrl"), cpsUrl: cpsUrl || undefined, appCpsUrl: appCpsUrl || undefined,
      episodes: episodes.map(({ episodeNumber, videoUrl }) => ({ episodeNumber, videoUrl })),
    };
    try {
      const response = await fetch(initialDrama ? `/api/admin/dramas/${initialDrama.id}` : "/api/admin/dramas", { method: initialDrama ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) {
        setFieldErrors(json.fieldErrors || {});
        const name = Object.keys(json.fieldErrors || {})[0];
        const field = name === "episodes" ? formRef.current?.querySelector(".episode-inputs input") : name && formRef.current?.elements.namedItem(name === "publicCode" ? "promoCode" : name);
        if (field instanceof HTMLElement) field.focus();
        setError(json.message || "Unable to save drama");
        return;
      }
      setResult({ ...json.draft, vizard: json.vizard, changedEpisodes: json.changedEpisodes, queueEpisodeNumbers: json.queueEpisodeNumbers });
    } catch (reason) {setError(reason instanceof Error ? `${reason.message}. If the result is uncertain, check Drama bundles before retrying.` : "Save failed. Please check Drama bundles before retrying.");}
    finally {setSaving(false);}
  }

  async function retryQueue() {
    if (!result || saving) return;
    setSaving(true);setError("");
    try {
      const response = await fetch(`/api/admin/dramas/${result.id}/queue`, {method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({episodeNumbers:result.queueEpisodeNumbers})});
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Queueing failed");
      setResult({...result,vizard:json.vizard});
    } catch(reason) {setError(reason instanceof Error ? reason.message : "Queueing failed");}
    finally {setSaving(false);}
  }

  return <form ref={formRef} className="drama-create" onSubmit={submit}>
    <div className="onboarding-summary"><b>{initialDrama ? "Update drama" : "Add drama → queue episodes → approve generation"}</b><span>{readyCount}/{episodes.length} videos ready in R2 · Saving does not start the Hook worker.</span><a href="/admin/dramas">Back to Drama bundles</a></div><section><span>01 · Drama details</span>
      <div className="rs-extension-import"><div className="rs-extension-heading"><div><b>Import from RS Boost</b><p>Paste one drama detail link. The Chrome extension fills the details and transfers Download Free Contents directly to R2.</p></div><span className={rsExtensionReady ? "ready" : "missing"}>{rsExtensionReady ? "Extension connected" : "Extension not detected"}</span></div><div className="rs-extension-row"><label><b>RS Boost detail link</b><input type="url" value={rsLink} onChange={(event) => setRsLink(event.target.value)} placeholder="https://cps.reelshort.com/resource-square/detail/…" /></label><button type="button" onClick={startRsImport} disabled={rsImporting || uploading || saving}>{rsImporting ? "Importing…" : "Import details & free videos"}</button></div>{rsNotice && <small className="rs-extension-notice">✓ {rsNotice}</small>}{!rsExtensionReady && <small>Install the unpacked extension from <code>chrome-extension/dramaclips-rs-importer</code>, then refresh. It uses your signed-in RS page only for the drama you request.</small>}</div>
      <div className="form-grid">
      <label><b>Title</b><input name="title" required defaultValue={initialDrama?.title} />{fieldMessage("title")}</label>
      <label><b>Slug</b><input ref={slugRef} name="slug" required disabled={uploading || saving} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="lowercase-title" defaultValue={initialDrama?.slug} />{fieldMessage("slug")}</label>
      <label className="wide"><b>RS referral code</b><input name="promoCode" required inputMode="numeric" pattern="[0-9]{4,8}" placeholder="e.g. 3470108" defaultValue={initialDrama?.promoCode || initialDrama?.publicCode} /><small>Used for both DramaClips search and ReelShort attribution.</small>{fieldMessage("publicCode")}</label>
      <label><b>Language</b><select name="language" defaultValue={initialDrama?.language || "en"}><option value="en">English</option><option value="zh">Chinese</option></select>{fieldMessage("language")}</label>
      <label><b>Tags, comma separated</b><input name="tags" defaultValue={initialDrama?.tags.join(", ")} />{fieldMessage("tags")}</label>
      <label className="wide"><b>Description</b><textarea name="description" required rows={5} defaultValue={initialDrama?.description} />{fieldMessage("description")}</label>
      <label className="wide"><b>Cover URL or path</b><input ref={coverRef} className={coverStatus.startsWith("Ready") ? "ready-url" : ""} name="coverUrl" required placeholder="Automatically filled after R2 upload, or paste a URL" defaultValue={initialDrama?.coverUrl} />{fieldMessage("coverUrl")}</label>
      <div className="cover-upload wide"><label><span>{coverFile ? coverFile.name : "Choose cover image"}</span><small>JPG, PNG, or WebP · 20 MB max</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCover(event.target.files?.[0])} disabled={uploading} /></label>{coverFile && <button type="button" onClick={() => void uploadCover()} disabled={uploading}>{coverStatus === "Failed" ? "Retry cover upload" : "Upload cover to R2"}</button>}{coverStatus && <div><span>{coverStatus}</span><strong>{coverProgress}%</strong><i className={coverStatus.startsWith("Ready") ? "ready" : coverStatus === "Failed" ? "failed" : ""} style={{width:`${coverProgress}%`}}/></div>}</div>
    </div></section>
    <section><div className="section-heading"><span>02 · Import preview episodes to R2</span><a href={r2DashboardUrl} target="_blank" rel="noreferrer">Open R2 bucket <ExternalLink /></a></div>
      <div className="remote-link-import"><label><b>Paste source MP4 links</b><textarea value={remoteLinks} onChange={(event)=>setRemoteLinks(event.target.value)} rows={7} placeholder="Paste one source MP4 URL per line" /></label><div><button type="button" onClick={fillRemoteLinks} disabled={uploading}>Fill episode list</button><button type="button" onClick={()=>void uploadRemoteLinks()} disabled={uploading||!episodes.some(episode=>isRemoteVideoUrl(episode.videoUrl))}>{uploading?"Transferring to R2…":episodes.some(episode=>episode.status==="Failed")?"Retry failed transfers":"Transfer filled links to R2"}</button></div><small>Links are assigned as EP 1, EP 2… in pasted order. Approved sources include Crazy Maple and Aliyun OSS signed MP4 links. The server streams each video directly to R2 and replaces the source URL below with its final R2 URL.</small></div>
      <details className="local-upload-fallback"><summary>Local-file upload · optional</summary>
      <label className={`upload-drop ${uploading ? "busy" : ""}`}><CloudUpload /><b>{selectedFiles.length ? `${selectedFiles.length} episode files selected` : "Choose videos or a folder"}</b><small>{selectedFiles.length ? "Review the queue below, then start the R2 upload." : "MP4, MOV, AVI, or 3GP · 10 GB max each"}</small><input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/3gpp" multiple onChange={(event) => selectFiles(event.target.files)} disabled={uploading} /></label>
      {selectedFiles.length > 0 && <button className="upload-selected" type="button" onClick={() => void uploadSelected()} disabled={uploading}>{uploading ? "Uploading to R2…" : episodes.some((episode) => episode.status === "Failed") ? "Retry failed uploads" : `Upload ${selectedFiles.length} episodes to R2`}</button>}
      </details>{fieldMessage("episodes")}<div className="episode-inputs">{episodes.map((episode, index) => <label key={episode.episodeNumber}><b>EP {episode.episodeNumber}</b><div className="episode-value"><input className={episode.status === "Ready" ? "ready-url" : ""} type="url" required disabled={uploading || saving} value={episode.videoUrl} placeholder={episode.name || "R2 HTTPS URL"} onChange={(event) => { const videoUrl=event.target.value; const ready=isReadyDramaVideo(videoUrl,r2PublicBase); patchEpisode(index,{videoUrl,status:ready?"Ready":isRemoteVideoUrl(videoUrl)?"Ready to transfer":"Needs R2 URL",progress:ready?100:0}); }} />{episode.status && <small><span>{episode.name}</span><strong>{episode.status === "Ready" ? "Ready · editable" : episode.status === "Uploading" ? `Uploading · ${episode.progress ?? 0}%` : episode.status}</strong></small>}{typeof episode.progress === "number" && <i className={episode.status?.toLowerCase()} style={{ width: `${episode.progress}%` }} />}</div>{episodes.length > 1 && !uploading && <button type="button" aria-label={`Remove episode ${episode.episodeNumber}`} onClick={() => removeEpisode(index)}><Trash2 /></button>}</label>)}</div>
      {!uploading && <button className="add-episode" type="button" onClick={() => setEpisodes((rows) => [...rows, { episodeNumber: nextEpisodeNumber(rows), videoUrl: "" }])} disabled={episodes.length >= 100}><Plus /> Add URL manually</button>}
    </section>
    <section><span>03 · RS promotion links</span><p>Temporarily use the App Promotion Link: Full Watch copies the Content Code before opening ReelShort.</p><label className="sensitive-field"><b>Content promotion link (for future direct-to-drama use)</b><input name="cpsUrl" type="url" required={!initialDrama?.hasCpsUrl} placeholder={initialDrama?.hasCpsUrl ? "Leave blank to keep the encrypted link" : "https://reelslink.com/cps/..."} /><small>Original drama link. It remains saved and is not replaced by temporary mode.</small>{fieldMessage("cpsUrl")}</label><label className="sensitive-field"><b>App promotion link (current Full Watch destination)</b><input name="appCpsUrl" type="url" required={!initialDrama?.hasAppCpsUrl} placeholder={initialDrama?.hasAppCpsUrl ? "Leave blank to keep the encrypted link" : "https://reelslink.com/cps/..."} /><small>After ReelShort opens, paste the automatically copied Content Code into the search bar.</small>{fieldMessage("appCpsUrl")}</label></section>
    {error && <div className="form-error" role="alert">{error} <a href="/admin/dramas">Check Drama bundles</a></div>}
    {result && <div className="form-success"><CheckCircle2 /><div><b>{initialDrama ? "Changes saved" : "Published to catalog"}: {result.title}</b><span>{result.episodeCount} preview episodes saved.</span>{result.vizard && <span className={result.vizard.status==="failed"?"field-error":""}>{result.vizard.status==="queued" ? `Queue checked for ${result.vizard.requested} episodes · ${result.vizard.accepted} newly queued. Waiting for your approval in Hook Studio.` : result.vizard.message}</span>}{Boolean(result.changedEpisodes?.length)&&<span>Replaced video for EP {result.changedEpisodes!.join(", ")}. Existing hooks were kept; select these episodes in Hook Studio if you want to regenerate.</span>}<div className="onboarding-next-actions"><a href="/admin/hooks">View queue · approve generation</a><a href={`/admin/dramas/${result.id}/edit`}>Edit saved drama</a>{result.vizard?.status==="failed"&&<button type="button" disabled={saving} onClick={()=>void retryQueue()}>Retry queueing only</button>}</div></div></div>}
    <button className="save-draft" disabled={saving || uploading || rsImporting || Boolean(!initialDrama && result)}>{uploading ? "Finish R2 uploads first" : saving ? "Saving…" : !initialDrama && result ? "Drama saved · use the links above" : initialDrama ? "Save changes & queue new episodes" : "Publish drama & queue episodes"}</button>
  </form>;
}
