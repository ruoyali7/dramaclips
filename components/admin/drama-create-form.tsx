"use client";

import { CheckCircle2, CloudUpload, ExternalLink, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { readRsTransfer, rsBookmarklet } from "@/lib/admin/rs-transfer";

type EpisodeRow = { episodeNumber: number; videoUrl: string; name?: string; progress?: number; status?: string };
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

export function DramaCreateForm({ r2DashboardUrl }: { r2DashboardUrl: string }) {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initial);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverStatus, setCoverStatus] = useState("");
  const [coverProgress, setCoverProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ title: string; episodeCount: number } | null>(null);
  const [error, setError] = useState("");
  const [rsLink, setRsLink] = useState("");
  const [rsText, setRsText] = useState("");
  const [importing, setImporting] = useState(false);
  const [needsRsText, setNeedsRsText] = useState(false);
  const [importNotice, setImportNotice] = useState("");
  const bookmarkletRef = useRef<HTMLAnchorElement>(null);
  const slugRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // React intentionally blocks javascript: href props. Set the bookmarklet on
    // the DOM node after mount so dragging it saves the intended browser tool.
    bookmarkletRef.current?.setAttribute("href", rsBookmarklet(`${window.location.origin}/admin/dramas/new`));
    const transfer = readRsTransfer(window.name);
    if (!transfer) return;
    window.name = "";
    setRsText(transfer.text);
    setRsLink(transfer.source);
    void importRs(transfer.text, transfer.source);
  // This must run once so a transferred page cannot be imported repeatedly.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function importRs(detailsText = rsText, link = rsLink) {
    if (importing) return;
    if (!detailsText.trim() && !link.trim()) { setError("Paste the full RS Boost details page before extracting."); return; }
    setImporting(true); setError(""); setImportNotice("");
    const response = await fetch("/api/admin/rs-import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ link: link.trim() || undefined, detailsText: detailsText.trim() || undefined }) });
    const result = await response.json();
    setImporting(false);
    if (!response.ok) {
      if (result.code?.startsWith("RS_CONNECTION")) { setNeedsRsText(true); setError("RS Boost requires sign-in for link-only import. Copy the full details page and paste it above instead."); return; }
      setError(result.message || "Could not import RS details"); return;
    }
    const drama = result.drama as Record<string, unknown>;
    for (const name of ["title", "slug", "language", "description", "coverUrl", "cpsUrl"] as const) {
      const value = drama[name];
      const field = formRef.current?.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (field && typeof value === "string" && value) field.value = value;
    }
    const promoCode = formRef.current?.elements.namedItem("promoCode") as HTMLInputElement | null;
    if (promoCode && typeof (drama.promoCode || drama.publicCode) === "string") promoCode.value = String(drama.promoCode || drama.publicCode);
    const tags = formRef.current?.elements.namedItem("tags") as HTMLInputElement | null;
    if (tags && Array.isArray(drama.tags)) tags.value = drama.tags.join(", ");
    if (typeof drama.freeChapterCount === "number" && drama.freeChapterCount > 0 && drama.freeChapterCount <= 10 && episodes.every((episode) => !episode.videoUrl)) setEpisodes(Array.from({ length: drama.freeChapterCount }, (_, index) => ({ episodeNumber: index + 1, videoUrl: "" })));
    setNeedsRsText(false);
    setImportNotice(`Imported${drama.chapterCount ? ` · ${drama.chapterCount} total chapters` : ""}${drama.freeChapterCount ? ` · ${drama.freeChapterCount} free previews` : ""}. Review every field before saving.`);
  }

  function patchEpisode(index: number, patch: Partial<EpisodeRow>) {
    setEpisodes((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  function selectFiles(filesInput: FileList | null) {
    if (!filesInput?.length || uploading) return;
    const files = naturalFiles(Array.from(filesInput));
    const invalid = files.find((file) => !acceptedTypes.has(file.type) || file.size <= 0 || file.size > 10 * 1024 ** 3);
    if (invalid) {
      setError(`${invalid.name} is not a supported video or exceeds 10 GB.`);
      return;
    }
    if (files.length > 10) {
      setError("A preview bundle can contain up to 10 episodes.");
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
    const body = {
      title: form.get("title"), slug: form.get("slug"), publicCode: form.get("promoCode"), promoCode: form.get("promoCode"),
      language: form.get("language"), tags: String(form.get("tags") || "").split(",").map((item) => item.trim()).filter(Boolean),
      description: form.get("description"), coverUrl: form.get("coverUrl"), cpsUrl: form.get("cpsUrl"),
      episodes: episodes.map(({ episodeNumber, videoUrl }) => ({ episodeNumber, videoUrl })),
    };
    const response = await fetch("/api/admin/dramas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    setSaving(false);
    if (!response.ok) { setError(json.message || "Unable to save draft"); return; }
    setResult(json.draft);
  }

  return <form ref={formRef} className="drama-create" onSubmit={submit}>
    <section><span>01 · Drama details</span>
      <div className="rs-helper"><div><b>One-click import from RS Boost</b><p>Drag this button to your bookmarks bar. On any signed-in RS resource page, click the bookmark to return here with the visible details filled in.</p></div><a ref={bookmarkletRef} href="#" onClick={(event) => event.preventDefault()}>Import to DramaClips</a><small>The helper transfers visible page text and its URL only. It never reads your RS password, cookies, or login token.</small></div>
      <div className="rs-import"><label className="rs-paste"><b>Or paste full RS Boost details page</b><textarea value={rsText} onChange={(event) => setRsText(event.target.value)} rows={7} placeholder="Open the RS resource page, Select All, Copy, then paste the full page text here." /></label><label className="rs-link-optional"><b>Resource link · optional</b><input type="url" value={rsLink} onChange={(event) => setRsLink(event.target.value)} placeholder="Not required when page text is pasted" /></label><button className="rs-extract" type="button" onClick={() => void importRs()} disabled={importing}>{importing ? "Extracting…" : "Extract drama details"}</button>{needsRsText && <small className="rs-hint">Link-only import requires an RS API connection. Use the one-click helper or paste the full page instead.</small>}{importNotice && <small className="rs-imported">✓ {importNotice}</small>}</div>
      <div className="form-grid">
      <label><b>Title</b><input name="title" required /></label>
      <label><b>Slug</b><input ref={slugRef} name="slug" required pattern="[a-z0-9-]+" placeholder="lowercase-title" /></label>
      <label className="wide"><b>RS referral code</b><input name="promoCode" required inputMode="numeric" pattern="[0-9]{4,8}" placeholder="e.g. 3470108" /><small>Used for both DramaClips search and ReelShort attribution.</small></label>
      <label><b>Language</b><select name="language"><option value="en">English</option><option value="zh">Chinese</option></select></label>
      <label><b>Tags, comma separated</b><input name="tags" /></label>
      <label className="wide"><b>Description</b><textarea name="description" required rows={5} /></label>
      <label className="wide"><b>Cover URL or path</b><input ref={coverRef} className={coverStatus.startsWith("Ready") ? "ready-url" : ""} name="coverUrl" required placeholder="Automatically filled after R2 upload, or paste a URL" /></label>
      <div className="cover-upload wide"><label><span>{coverFile ? coverFile.name : "Choose cover image"}</span><small>JPG, PNG, or WebP · 20 MB max</small><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectCover(event.target.files?.[0])} disabled={uploading} /></label>{coverFile && <button type="button" onClick={() => void uploadCover()} disabled={uploading}>{coverStatus === "Failed" ? "Retry cover upload" : "Upload cover to R2"}</button>}{coverStatus && <div><span>{coverStatus}</span><strong>{coverProgress}%</strong><i className={coverStatus.startsWith("Ready") ? "ready" : coverStatus === "Failed" ? "failed" : ""} style={{width:`${coverProgress}%`}}/></div>}</div>
    </div></section>
    <section><div className="section-heading"><span>02 · Upload preview episodes</span><a href={r2DashboardUrl} target="_blank" rel="noreferrer">Open R2 bucket <ExternalLink /></a></div><p>Select up to 10 authorized files. Successful uploads automatically fill each editable R2 HTTPS URL below.</p>
      <label className={`upload-drop ${uploading ? "busy" : ""}`}><CloudUpload /><b>{selectedFiles.length ? `${selectedFiles.length} episode files selected` : "Choose videos or a folder"}</b><small>{selectedFiles.length ? "Review the queue below, then start the R2 upload." : "MP4, MOV, AVI, or 3GP · 10 GB max each"}</small><input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/3gpp" multiple onChange={(event) => selectFiles(event.target.files)} disabled={uploading} /></label>
      {selectedFiles.length > 0 && <button className="upload-selected" type="button" onClick={() => void uploadSelected()} disabled={uploading}>{uploading ? "Uploading to R2…" : episodes.some((episode) => episode.status === "Failed") ? "Retry failed uploads" : `Upload ${selectedFiles.length} episodes to R2`}</button>}
      <div className="episode-inputs">{episodes.map((episode, index) => <label key={episode.episodeNumber}><b>EP {episode.episodeNumber}</b><div className="episode-value"><input className={episode.status === "Ready" ? "ready-url" : ""} type="url" required value={episode.videoUrl} placeholder={episode.name || "R2 HTTPS URL"} onChange={(event) => patchEpisode(index, { videoUrl: event.target.value })} />{episode.status && <small><span>{episode.name}</span><strong>{episode.status === "Ready" ? "Ready · editable" : episode.status === "Uploading" ? `Uploading · ${episode.progress ?? 0}%` : episode.status}</strong></small>}{typeof episode.progress === "number" && <i className={episode.status?.toLowerCase()} style={{ width: `${episode.progress}%` }} />}</div>{episodes.length > 1 && !uploading && <button type="button" aria-label={`Remove episode ${episode.episodeNumber}`} onClick={() => removeEpisode(index)}><Trash2 /></button>}</label>)}</div>
      {!uploading && <button className="add-episode" type="button" onClick={() => setEpisodes((rows) => [...rows, { episodeNumber: rows.length + 1, videoUrl: "" }])} disabled={episodes.length >= 10}><Plus /> Add URL manually</button>}
    </section>
    <section><span>03 · Watch Full destination</span><p>Use the RS <b>Content Promotion Link</b>, not the App Promotion Link. Viewers are sent here after the free previews.</p><label className="sensitive-field"><b>Content promotion link</b><input name="cpsUrl" type="url" required placeholder="https://reelslink.com/cps/..." /><small>Encrypted server-side and never returned after saving.</small></label></section>
    {error && <div className="form-error">{error}</div>}
    {result && <div className="form-success"><CheckCircle2 /><div><b>Draft saved: {result.title}</b><span>{result.episodeCount} preview episodes ready for review.</span></div></div>}
    <button className="save-draft" disabled={saving || uploading}>{uploading ? "Finish R2 uploads first" : saving ? "Encrypting & saving…" : "Save encrypted draft"}</button>
  </form>;
}
