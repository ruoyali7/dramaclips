"use client";

import { CheckCircle2, CloudUpload, Plus, Trash2 } from "lucide-react";
import { FormEvent, useRef, useState } from "react";

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
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress(Math.round((event.loaded / event.total) * 100));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("R2 upload failed. Check the bucket CORS policy."));
    xhr.send(file);
  });
}

export function DramaCreateForm() {
  const [episodes, setEpisodes] = useState<EpisodeRow[]>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ title: string; episodeCount: number } | null>(null);
  const [error, setError] = useState("");
  const slugRef = useRef<HTMLInputElement>(null);

  function patchEpisode(index: number, patch: Partial<EpisodeRow>) {
    setEpisodes((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  }

  async function upload(filesInput: FileList | null) {
    if (!filesInput?.length || uploading) return;
    const slug = slugRef.current?.value.trim() || "";
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      setError("Enter a valid slug before selecting episode files.");
      return;
    }
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
    setUploading(true);
    setEpisodes(files.map((file, index) => ({ episodeNumber: index + 1, videoUrl: "", name: file.name, progress: 0, status: "Preparing" })));
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
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
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
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
      title: form.get("title"), slug: form.get("slug"), publicCode: form.get("publicCode"), promoCode: form.get("promoCode"),
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

  return <form className="drama-create" onSubmit={submit}>
    <section><span>01 · Drama details</span><div className="form-grid">
      <label><b>Title</b><input name="title" required /></label>
      <label><b>Slug</b><input ref={slugRef} name="slug" required pattern="[a-z0-9-]+" placeholder="lowercase-title" /></label>
      <label><b>Public code</b><input name="publicCode" required inputMode="numeric" /></label>
      <label><b>RS promotion code</b><input name="promoCode" required /></label>
      <label><b>Language</b><select name="language"><option value="en">English</option><option value="zh">Chinese</option></select></label>
      <label><b>Tags, comma separated</b><input name="tags" /></label>
      <label className="wide"><b>Description</b><textarea name="description" required rows={5} /></label>
      <label className="wide"><b>Cover URL or path</b><input name="coverUrl" required /></label>
    </div></section>
    <section><span>02 · Upload preview episodes</span><p>Select up to 10 authorized files. They upload directly from this browser to R2 and are ordered by filename.</p>
      <label className={`upload-drop ${uploading ? "busy" : ""}`}><CloudUpload /><b>{uploading ? "Uploading episodes…" : "Choose videos or a folder"}</b><small>MP4, MOV, AVI, or 3GP · 10 GB max each</small><input type="file" accept="video/mp4,video/quicktime,video/x-msvideo,video/3gpp" multiple onChange={(event) => upload(event.target.files)} disabled={uploading} /></label>
      <div className="episode-inputs">{episodes.map((episode, index) => <label key={episode.episodeNumber}><b>EP {episode.episodeNumber}</b><div className="episode-value"><input type="url" required value={episode.videoUrl} placeholder={episode.name || "R2 HTTPS URL"} onChange={(event) => patchEpisode(index, { videoUrl: event.target.value })} />{episode.status && <small>{episode.name} · {episode.status} {episode.progress ?? 0}%</small>}{typeof episode.progress === "number" && <i style={{ width: `${episode.progress}%` }} />}</div>{episodes.length > 1 && !uploading && <button type="button" onClick={() => setEpisodes((rows) => rows.filter((_, rowIndex) => rowIndex !== index).map((row, rowIndex) => ({ ...row, episodeNumber: rowIndex + 1 })))}><Trash2 /></button>}</label>)}</div>
      {!uploading && <button className="add-episode" type="button" onClick={() => setEpisodes((rows) => [...rows, { episodeNumber: rows.length + 1, videoUrl: "" }])} disabled={episodes.length >= 10}><Plus /> Add URL manually</button>}
    </section>
    <section><span>03 · ReelShort destination</span><label className="sensitive-field"><b>Resource promotion link</b><input name="cpsUrl" type="url" required placeholder="https://reelslink.com/cps/..." /><small>Encrypted server-side and never returned after saving.</small></label></section>
    {error && <div className="form-error">{error}</div>}
    {result && <div className="form-success"><CheckCircle2 /><div><b>Draft saved: {result.title}</b><span>{result.episodeCount} preview episodes ready for review.</span></div></div>}
    <button className="save-draft" disabled={saving || uploading}>{uploading ? "Finish R2 uploads first" : saving ? "Encrypting & saving…" : "Save encrypted draft"}</button>
  </form>;
}
