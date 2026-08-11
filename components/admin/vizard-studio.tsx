"use client";

import { CheckCircle2, CircleAlert, LoaderCircle, Scissors } from "lucide-react";
import { useMemo, useState } from "react";

type Source = { id: string; title: string; slug: string; language: string; episodes: { episodeNumber: number; videoUrl: string }[] };
type QueueRow = { episodeNumber: number; videoUrl: string; selected: boolean; state: "ready" | "submitting" | "done" | "failed"; detail?: string };

export function VizardStudio({ sources }: { sources: Source[] }) {
  const [sourceId, setSourceId] = useState(sources[0]?.id || "");
  const source = sources.find((item) => item.id === sourceId);
  const [queues, setQueues] = useState<Record<string, QueueRow[]>>({});
  const [running, setRunning] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const queue = useMemo(() => queues[sourceId] || source?.episodes.map((episode) => ({ ...episode, selected: true, state: "ready" as const })) || [], [queues, source, sourceId]);
  function setQueue(next: QueueRow[]) { setQueues((all) => ({ ...all, [sourceId]: next })); }
  function patch(number: number, value: Partial<QueueRow>) {
    setQueues((all) => {
      const base = all[sourceId] || source?.episodes.map((episode) => ({ ...episode, selected: true, state: "ready" as const })) || [];
      return { ...all, [sourceId]: base.map((row) => row.episodeNumber === number ? { ...row, ...value } : row) };
    });
  }
  function wait(seconds: number) { return new Promise<void>((resolve) => { let left = seconds; setCountdown(left); const timer = window.setInterval(() => { left -= 1; setCountdown(left); if (left <= 0) { window.clearInterval(timer); resolve(); } }, 1000); }); }

  async function start(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!source || running) return;
    setRunning(true);
    const form = new FormData(event.currentTarget);
    const selected = queue.filter((row) => row.selected && row.state !== "done");
    for (let index = 0; index < selected.length; index += 1) {
      const row = selected[index];
      patch(row.episodeNumber, { state: "submitting", detail: "Sending to Vizard" });
      try {
        const response = await fetch("/api/admin/vizard/submit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
          projectName: `${source.title} - EP ${row.episodeNumber}`, videoUrl: row.videoUrl, language: form.get("language"),
          preferLength: Number(form.get("preferLength")), maxClipNumber: Number(form.get("maxClipNumber")), ratio: Number(form.get("ratio")),
          subtitles: form.get("subtitles") === "on", headline: form.get("headline") === "on", clipModel: form.get("clipModel"),
        }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Submission failed");
        patch(row.episodeNumber, { state: "done", detail: `Project ${result.projectId}` });
      } catch (error) {
        patch(row.episodeNumber, { state: "failed", detail: error instanceof Error ? error.message : "Submission failed" });
      }
      if (index < selected.length - 1) await wait(30);
    }
    setCountdown(0); setRunning(false);
  }

  if (!sources.length) return <div className="admin-empty"><Scissors /><h2>No published dramas yet</h2><p>Upload and publish a drama first. Its R2 episodes will appear here automatically.</p></div>;
  return <form className="vizard-studio" onSubmit={start}>
    <section className="vizard-settings"><span>01 · Source & clip settings</span>
      <label><b>Drama</b><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} disabled={running}>{sources.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <div className="vizard-grid"><label><b>Language</b><select name="language" defaultValue={source?.language || "auto"}><option value="auto">Auto detect</option><option value="en">English</option><option value="zh">Chinese</option><option value="es">Spanish</option></select></label><label><b>Clip length</b><select name="preferLength" defaultValue="1"><option value="0">Auto</option><option value="1">Under 30 sec</option><option value="2">30–60 sec</option><option value="3">60–90 sec</option><option value="4">90 sec–3 min</option></select></label><label><b>Max clips / episode</b><input name="maxClipNumber" type="number" min="1" max="20" defaultValue="3" /></label><label><b>Ratio</b><select name="ratio" defaultValue="1"><option value="1">9:16</option><option value="2">1:1</option><option value="3">4:5</option><option value="4">16:9</option></select></label><label><b>Model</b><select name="clipModel" defaultValue="clip_v1"><option value="clip_v1">Clip v1</option><option value="clip_v2">Clip v2</option></select></label></div>
      <div className="vizard-switches"><label><input type="checkbox" name="subtitles" defaultChecked /> Auto subtitles</label><label><input type="checkbox" name="headline" defaultChecked /> AI headline / hook</label></div>
    </section>
    <section className="vizard-queue"><span>02 · Episode queue</span><div className="queue-actions"><button type="button" onClick={() => setQueue(queue.map((row) => ({ ...row, selected: true })))} disabled={running}>Select all</button><button type="button" onClick={() => setQueue(queue.map((row) => ({ ...row, selected: false })))} disabled={running}>Clear</button></div>
      {queue.map((row) => <label className={`queue-row ${row.state}`} key={row.episodeNumber}><input type="checkbox" checked={row.selected} onChange={(event) => patch(row.episodeNumber, { selected: event.target.checked })} disabled={running || row.state === "done"} /><b>EP {row.episodeNumber}</b><small>{row.detail || "R2 source ready"}</small>{row.state === "submitting" ? <LoaderCircle className="spin" /> : row.state === "done" ? <CheckCircle2 /> : row.state === "failed" ? <CircleAlert /> : null}</label>)}
      <button className="save-draft" disabled={running || !queue.some((row) => row.selected && row.state !== "done")}>{running ? countdown > 0 ? `Rate-limit pause · next in ${countdown}s` : "Submitting…" : "Send selected episodes to Vizard"}</button>
    </section>
  </form>;
}
