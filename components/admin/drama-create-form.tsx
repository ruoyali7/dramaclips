"use client";

import { CheckCircle2, CloudUpload, ExternalLink, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

type EpisodeRow = { episodeNumber: number; videoUrl: string; name?: string; progress?: number; status?: string };
type EditableDrama = { id: string; title: string; slug: string; publicCode: string; promoCode: string; language: string; tags: string[]; description: string; coverUrl: string; episodes: Array<{episodeNumber:number;videoUrl:string}>; hasCpsUrl: boolean; hasAppCpsUrl: boolean };
const initial: EpisodeRow[] = [1, 2, 3, 4, 5].map((episodeNumber) => ({ episodeNumber, videoUrl: "" }));
const acceptedTypes = new Set(["video/mp4", "video/quicktime", "video/x-msvideo", "video/3gpp"]);

function naturalFiles(files: File[]) {
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
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

export function DramaCreateForm({ r2DashboardUrl, initialDrama }: { r2DashboardUrl: string; initialDrama?: EditableDrama }) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initialDrama?.episodes || initial);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverStatus, setCoverStatus] = useState("");
  const [coverProgress, setCoverProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ title: string; episodeCount: number } | null>(null);
  const [error, setError] = useState("");
  const [rsLink, setRsLink] = useState("");
  const [rsImporting, setRsImporting] = useState(false);
  const [rsExtensionReady, setRsExtensionReady] = useState(false);
  const [rsNotice, setRsNotice] = useState("");
  const [remoteLinks, setRemoteLinks] = useState("");
  const slugRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== window || !event.data || event.data.source !== "dramaclips-rs-extension") return;
      if (event.data.type === "RS_EXTENSION_READY") { setRsExtensionReady(true); return; }
      if (event.data.type === "RS_IMPORT_ERROR") { setRsImporting(false); setError(String(event.data.message || "RS Boost import failed")); return; }
      if (event.data.type !== "RS_IMPORT_RESULT" || typeof event.data.text !== "string" || typeof event.data.url !== "string") return;
      void importCapturedRs(event.data.url, event.data.text);
    }
    window.addEventListener("message", receive);
    window.postMessage({ source: "dramaclips", type: "RS_EXTENSION_PING" }, window.location.origin);
    return () => window.removeEventListener("message", receive);
  }, []);

  async function importCapturedRs(link: string, detailsText: string) {
    setError(""); setRsNotice("Reading captured drama details…");
    try {
      const response = await fetch("/api/admin/rs-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link, detailsText }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not read RS Boost details");
      const drama = result.drama as Record<string, unknown>;
      for (const name of ["title", "slug", "language", "description", "coverUrl", "cpsUrl", "appCpsUrl"] as const) {
        const value = drama[name];
        const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        if (field && typeof value === "string" && value) field.value = value;
      }
      const promoCode = formRef.current?.elements.namedItem("promoCode") as HTMLInputElement | null;
      if (promoCode && typeof (drama.promoCode || drama.publicCode) === "string") promoCode.value = String(drama.promoCode || drama.publicCode);
      const tags = formRef.current?.elements.namedItem("tags") as HTMLInputElement | null;
      if (tags && Array.isArray(drama.tags)) tags.value = drama.tags.join(", ");
      if (typeof drama.freeChapterCount === "number" && drama.freeChapterCount > 0 && drama.freeChapterCount <= 100 && episodes.every((episode) => !episode.videoUrl)) setEpisodes(Array.from({ length: drama.freeChapterCount }, (_, index) => ({ episodeNumber: index + 1, videoUrl: "" })));
      setRsLink(link); setRsNotice(`Imported${drama.chapterCount ? ` · ${drama.chapterCount} total episodes` : ""}${drama.freeChapterCount ? ` · ${drama.freeChapterCount} free previews` : ""}. Review before saving.`);
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
        if (url.protocol !== "https:" || url.hostname !== "v-mps.crazymaplestudios.com" || !url.pathname.toLowerCase().endsWith(".mp4")) throw new Error();
      }
    } catch {
      setError("Every URL must be an HTTPS MP4 link from v-mps.crazymaplestudios.com.");
      return;
    }
    setError("");
    setSelectedFiles([]);
    setEpisodes(links.map((videoUrl, index) => ({ episodeNumber: index + 1, videoUrl, name: `Remote EP ${index + 1}`, progress: 0, status: "Ready to transfer" })));
  }

  async function uploadRemoteLinks() {
    if (uploading) return;
    const slug = slugRef.current?.value.trim() || "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) { setError("Enter a valid slug before transferring videos to R2."); slugRef.current?.focus(); return; }
    const pending = episodes.map((episode, index) => ({ episode, index })).filter(({ episode }) => episode.videoUrl.includes("v-mps.crazymaplestudios.com") && episode.status !== "Ready");
    if (!pending.length) { setError("Fill the episode list with source video links first."); return; }
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
    setEpisodes((rows) => rows.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, episodeNumber: rowIndex + 1 })));
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
    if (uploading) return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const cpsUrl = String(form.get("cpsUrl") || "").trim();
    const appCpsUrl = String(form.get("appCpsUrl") || "").trim();
    const body = {
      title: form.get("title"), slug: form.get("slug"), publicCode: form.get("promoCode"), promoCode: form.get("promoCode"),
      language: form.get("language"), tags: String(form.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
      description: form.get("description"), coverUrl: form.get("coverUrl"), cpsUrl: cpsUrl || undefined, appCpsUrl: appCpsUrl || undefined,
      episodes: episodes.map(({ episodeNumber, videoUrl }) => ({ episodeNumber, videoUrl })),
    };
    const response = await fetch(initialDrama ? `/api/admin/dramas/${initialDrama.id}` : "/api/admin/dramas", { method: initialDrama ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    setSaving(false);
    if (!response.ok) { setError(json.message || "Unable to save draft"); return; }
    setResult(json.draft);
  }

  return <form ref={formRef} className="drama-create" onSubmit={submit}>
    <section><span>01 · Drama details</span>
      <div className="rs-extension-import"><div className="rs-extension-heading"><div><b>Import from RS Boost</b><p>Paste one drama detail link. The Chrome extension opens your signed-in RS page and fills the available fields below.</p></div><span className={rsExtensionReady ? "ready" : "missing"}>{rsExtensionReady ? "Extension connected" : "Extension not detected"}</span></div><div className="rs-extension-row"><label><b>RS Boost detail link</b><input type="url" value={rsLink} onChange={(event) => setRsLink(event.target.value)} placeholder="https://cps.reelshort.com/resource-square/detail/…" /></label><button type="button" onClick={startRsImport} disabled={rsImporting}>{rsImporting ? "Importing…" : "Import & autofill"}</button></div>{rsNotice && <small className="rs-extension-notice">✓ {rsNotice}</small>}{!rsExtensionReady && <small>Install the unpacked extension from <code>chrome-extension/dramaclips-rs-importer</code>, then refresh. It reads only the single RS page you request.</small>}</div>
      <div className="form-grid">
      <label><b>Title</b><input name="title" required defaultValue={initialDrama?.title} /></label>
      <label><b>Slug</b><input ref={slugRef} name="slug" required pattern="[a-z0-9-]+" placeholder="lowercase-title" defaultValue={initialDrama?.slug} /></label>
      <label className="wide"><b>RS referral code</b><input name="promoCode" required inputMode="numeric" pattern="[0-9]{4,8}" placeholder="e.g. 3470108" defaultValue={initialDrama?.promoCode || initialDrama?.publicCode} /><small>Used for both DramaClips search and ReelShort attribution.</small></label>
      <label><b>Language</b><select name="language" defaultValue={initialDrama?.language || "en"}><option value="en">English</option><option value="zh">Chinese</option></select></label>
      <label><b>Tags, comma separated</b><input name="tags" defaultValue={initialDrama?.tags.join(", ")} /></label>
      <label className="wide"><b>Description</b><textarea name="description" required rows={5} defaultValue={initialDrama?.description} /></label>
      <label className="wide"><b>Cover URL or path</b><input ref={coverRef} className={coverStatus.startsWith("Ready") ? "ready-url" : ""} name="coverUrl" required placeholder="Automatically filled after R2 upload, or paste a URL" defaultValue={initialDrama?.coverUrl} /></label>
      <div className="cover-upload wide"><label><span>{coverFile ? coverFile.name : "Choose cover image"}</span><small>JPG, PNG, or WebP · 20 MB max</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCover(event.target.files?.[0])} disabled={uploading} /></label>{coverFile && <button type="button" onClick={() => void uploadCover()} disabled={uploading}>{coverStatus === "Failed" ? "Retry cover upload" : "Upload cover to R2"}</button>}{coverStatus && <div><span>{coverStatus}</span><strong>{coverProgress}%</strong><i className={coverStatus.startsWith("Ready") ? "ready" : coverStatus === "Failed" ? "failed" : ""} style={{width:`${coverProgress}%`}}/></div>}</div>
    </div></section>
    <section><div className="section-heading"><span>02 · Import preview episodes to R2</span><a href={r2DashboardUrl} target="_blank" rel="noreferrer">Open R2 bucket <ExternalLink /></a></div>
      <div className="remote-link-import"><label><b>Paste source MP4 links</b><textarea value={remoteLinks} onChange={(event)=>setRemoteLinks(event.target.value)} rows={7} placeholder="Paste one v-mps.crazymaplestudios.com MP4 URL per line" /></label><div><button type="button" onClick={fillRemoteLinks} disabled={uploading}>Fill episode list</button><button type="button" onClick={()=>void uploadRemoteLinks()} disabled={uploading||!episodes.some(episode=>episode.videoUrl.includes("v-mps.crazymaplestudios.com"))}>{uploading?"Transferring to R2…":episodes.some(episode=>episode.status==="Failed")?"Retry failed transfers":"Transfer filled links to R2"}</button></div><small>Links are assigned as EP 1, EP 2… in pasted order. The server streams each video directly to R2 and replaces the source URL below with its final R2 URL.</small></div>
      <p><b>Local-file fallback:</b> you can still choose downloaded files or a folder instead.</p>
      <label className={`upload-drop ${uploading ? "busy" : ""}`}><CloudUpload /><b>{selectedFiles.length ? `${selectedFiles.length} episode files selected` : "Choose videos or a folder"}</b><small>{selectedFiles.length ? "Review the queue below, then start the R2 upload." : "MP4, MOV, AVI, or 3GP · 10 GB max each"}</small><input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/3gpp" multiple onChange={(event) => selectFiles(event.target.files)} disabled={uploading} /></label>
      {selectedFiles.length > 0 && <button className="upload-selected" type="button" onClick={() => void uploadSelected()} disabled={uploading}>{uploading ? "Uploading to R2…" : episodes.some((episode) => episode.status === "Failed") ? "Retry failed uploads" : `Upload ${selectedFiles.length} episodes to R2`}</button>}
      <div className="episode-inputs">{episodes.map((episode, index) => <label key={episode.episodeNumber}><b>EP {episode.episodeNumber}</b><div className="episode-value"><input className={episode.status === "Ready" ? "ready-url" : ""} type="url" required value={episode.videoUrl} placeholder={episode.name || "R2 HTTPS URL"} onChange={(event) => patchEpisode(index, { videoUrl: event.target.value })} />{episode.status && <small><span>{episode.name}</span><strong>{episode.status === "Ready" ? "Ready · editable" : episode.status === "Uploading" ? `Uploading · ${episode.progress ?? 0}%` : episode.status}</strong></small>}{typeof episode.progress === "number" && <i className={episode.status?.toLowerCase()} style={{ width: `${episode.progress}%` }} />}</div>{episodes.length > 1 && !uploading && <button type="button" aria-label={`Remove episode ${episode.episodeNumber}`} onClick={() => removeEpisode(index)}><Trash2 /></button>}</label>)}</div>
      {!uploading && <button className="add-episode" type="button" onClick={() => setEpisodes((rows) => [...rows, { episodeNumber: rows.length + 1, videoUrl: "" }])} disabled={episodes.length >= 100}><Plus /> Add URL manually</button>}
    </section>
    <section><span>03 · RS promotion links</span><p>临时使用 App Promotion Link：用户点击 Full Watch 后自动复制 Content Code，再打开 ReelShort 搜索。</p><label className="sensitive-field"><b>Content promotion link（恢复剧集直达时使用）</b><input name="cpsUrl" type="url" required={!initialDrama?.hasCpsUrl} placeholder={initialDrama?.hasCpsUrl ? "Leave blank to keep the encrypted link" : "https://reelslink.com/cps/..."} /><small>保存原始剧集 link，不会被临时模式覆盖。</small></label><label className="sensitive-field"><b>App promotion link（当前 Full Watch 使用）</b><input name="appCpsUrl" type="url" required={!initialDrama?.hasAppCpsUrl} placeholder={initialDrama?.hasAppCpsUrl ? "Leave blank to keep the encrypted link" : "https://reelslink.com/cps/..."} /><small>打开 ReelShort 后，在搜索框粘贴页面自动复制的 Content Code。</small></label></section>
    {error && <div className="form-error">{error}</div>}
    {result && <div className="form-success"><CheckCircle2 /><div><b>{initialDrama ? "Changes saved" : "Draft saved"}: {result.title}</b><span>{result.episodeCount} preview episodes ready.</span></div></div>}
    <button className="save-draft" disabled={saving || uploading}>{uploading ? "Finish R2 uploads first" : saving ? "Encrypting & saving…" : initialDrama ? "Save changes" : "Save encrypted draft"}</button>
  </form>;
}
