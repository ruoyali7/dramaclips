"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LoaderCircle,
  Play,
  Scissors,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { VizardStudio } from "./vizard-studio";

type Episode = { episodeNumber: number; videoUrl: string };
type Asset = {
  id: string;
  kind: "clip" | "candidate" | "vizard";
  jobId?: string;
  dramaId: string;
  dramaSlug: string;
  dramaTitle: string;
  coverUrl: string;
  title: string;
  sourceEpisodes: number[];
  videoUrl: string;
  durationSeconds: number;
  generator: "Built-in" | "Vizard";
  status: "published" | "publishing" | "scheduled" | "failed" | "ready";
  createdAt: string;
};
type Source = {
  id: string;
  title: string;
  slug: string;
  language: string;
  coverUrl: string;
  episodes: Episode[];
  analyzedEpisodes: number[];
};
type Job = {
  id: string;
  status: string;
  progress: number;
  errorMessage?: string;
};
type GenerationHistory = {
  id: string;
  method: "Built-in" | "Vizard";
  dramaId: string;
  dramaTitle: string;
  coverUrl: string;
  sourceEpisodes: number[];
  status: string;
  progress: number;
  resultCount: number;
  createdAt: string;
  errorMessage?: string;
};
const statusLabel = {
  published: "Published",
  publishing: "Publishing",
  scheduled: "Scheduled",
  failed: "Failed",
  ready: "Saved",
};

function ReviewVideo({ src }: { src: string }) {
  const [buffering, setBuffering] = useState(false),
    [failed, setFailed] = useState(false),
    videoRef = useRef<HTMLVideoElement>(null),
    recoveredRef = useRef(false);
  function retry() {
    const video = videoRef.current;
    if (!video) return;
    const position = video.currentTime;
    setFailed(false);
    setBuffering(true);
    video.load();
    video.addEventListener(
      "loadedmetadata",
      () => {
        video.currentTime = Math.min(position, video.duration || position);
        void video.play().catch(() => setFailed(true));
      },
      { once: true },
    );
  }
  return (
    <div className="review-video-shell">
      <video
        ref={videoRef}
        src={src}
        controls
        preload="auto"
        playsInline
        onLoadStart={() => setBuffering(true)}
        onWaiting={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onPlaying={() => setBuffering(false)}
        onStalled={() => {
          if (!recoveredRef.current) {
            recoveredRef.current = true;
            retry();
          } else {
            setBuffering(false);
            setFailed(true);
          }
        }}
        onError={() => {
          setBuffering(false);
          setFailed(true);
        }}
      />
      {buffering && <span>Buffering video…</span>}
      {failed && <button onClick={retry}>Resume video</button>}
    </div>
  );
}

export function HookStudioDashboard({
  sources,
  assets,
  generationHistory,
}: {
  sources: Source[];
  assets: Asset[];
  generationHistory: GenerationHistory[];
}) {
  const [pageSize, setPageSize] = useState(5),
    [page, setPage] = useState(1),
    [expandedLibraryIds, setExpandedLibraryIds] = useState<string[]>([]),
    [libraryStateRestored, setLibraryStateRestored] = useState(false),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [sourceId, setSourceId] = useState(sources[0]?.id || ""),
    [episodes, setEpisodes] = useState<number[]>([]),
    [episodeSelections, setEpisodeSelections] = useState<
      Record<string, number[]>
    >({}),
    [episodePreview, setEpisodePreview] = useState<{
      sourceId: string;
      episode: Episode;
    } | null>(null),
    [direction, setDirection] = useState(""),
    [method, setMethod] = useState<"built-in" | "vizard">("vizard"),
    [historyPage, setHistoryPage] = useState(1),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState<Job | null>(null),
    [error, setError] = useState("");
  const generatorRef = useRef<HTMLDetailsElement>(null),
    source = sources.find((item) => item.id === sourceId),
    pages = Math.max(1, Math.ceil(sources.length / pageSize)),
    rows = sources.slice((page - 1) * pageSize, page * pageSize);
  const groupedAssets = useMemo(() => {
    const map = new Map<string, Asset[]>();
    for (const asset of assets)
      map.set(asset.dramaId, [...(map.get(asset.dramaId) || []), asset]);
    return map;
  }, [assets]);
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("dramaclips:hooks-library") || "{}");
      if ([5, 10].includes(saved.pageSize)) setPageSize(saved.pageSize);
      if (Number.isInteger(saved.page) && saved.page > 0) setPage(saved.page);
      if (Array.isArray(saved.expandedIds)) setExpandedLibraryIds(saved.expandedIds.filter((id: unknown) => typeof id === "string"));
      if (typeof saved.selectedHookId === "string") setSelectedId(saved.selectedHookId);
    } catch {}
    setLibraryStateRestored(true);
  }, []);
  useEffect(() => {
    if (!libraryStateRestored) return;
    window.localStorage.setItem("dramaclips:hooks-library", JSON.stringify({ page, pageSize, expandedIds: expandedLibraryIds, selectedHookId: selectedId || "" }));
  }, [page, pageSize, expandedLibraryIds, selectedId, libraryStateRestored]);
  useEffect(() => {
    if (
      !job ||
      ["review_ready", "no_result", "failed", "canceled"].includes(job.status)
    )
      return;
    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/admin/hooks/jobs?id=${encodeURIComponent(job.id)}`,
        { cache: "no-store" },
      );
      const json = await response.json();
      if (response.ok) setJob(json.job);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job]);
  function toggleEpisode(number: number) {
    setEpisodes((items) =>
      items.includes(number)
        ? items.filter((item) => item !== number)
        : items.length < 15
          ? [...items, number].sort((a, b) => a - b)
          : items,
    );
  }
  function toggleLibraryEpisode(dramaId: string, number: number) {
    setEpisodeSelections((current) => {
      const selected = current[dramaId] || [];
      return {
        ...current,
        [dramaId]: selected.includes(number)
          ? selected.filter((item) => item !== number)
          : selected.length < 15
            ? [...selected, number].sort((a, b) => a - b)
            : selected,
      };
    });
  }
  function useForGeneration(item: Source) {
    const selected = episodeSelections[item.id] || [];
    if (!selected.length) return;
    setSourceId(item.id);
    setEpisodes(selected);
    setMethod("vizard");
    if (generatorRef.current) {
      generatorRef.current.open = true;
      generatorRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }
  function openGenerationHistory(item: GenerationHistory) {
    setSourceId(item.dramaId);
    setEpisodes(item.sourceEpisodes);
    setMethod(item.method === "Vizard" ? "vizard" : "built-in");
    if (item.method === "Built-in") setJob({id:item.id,status:item.status,progress:item.progress,errorMessage:item.errorMessage});
    if (generatorRef.current) {
      generatorRef.current.open = true;
      generatorRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  async function generate() {
    if (!source || !episodes.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/hooks/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dramaId: source.id,
          episodeNumbers: episodes,
          forceNew: true,
          settings: {
            maxHooks: 6,
            coverDuration: 0.1,
            hookTitle: true,
            creativeDirection: direction,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.message || "Could not start generation");
      setJob(json.job);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not start generation",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(asset: Asset) {
    if (
      !window.confirm(
        `Delete “${asset.title}”? This removes the generated video and record.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const url =
        asset.kind === "vizard"
          ? `/api/admin/vizard/assets/${asset.id}`
          : asset.kind === "clip"
            ? `/api/admin/hooks/clips/${asset.id}`
            : `/api/admin/hooks/jobs/${asset.jobId}/candidates/${asset.id}`;
      const response = await fetch(
        url,
        asset.kind === "vizard"
          ? {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ action: "delete" }),
            }
          : { method: "DELETE" },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.message || "Could not delete hook");
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not delete hook",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!sources.length)
    return (
      <div className="admin-empty">
        <Scissors />
        <h2>No published dramas</h2>
      </div>
    );
  return (
    <div className="hook-dashboard">
      <section className="drama-hook-library">
        <div className="hook-section-title">
          <div>
            <span>01 · Drama & hook library</span>
            <h2>Choose what to generate</h2>
          </div>
          <div>
            <b>{sources.length}</b>
            <small>dramas · {assets.length} hooks</small>
          </div>
        </div>
        <div className="hook-table-tools">
          <label>
            Rows{" "}
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value="5">5</option>
              <option value="10">10</option>
            </select>
          </label>
          <small>
            Gray episodes have never produced a hook. Green episodes have.
          </small>
        </div>
        <div className="drama-library-head">
          <b>Drama</b>
          <b>Episode coverage</b>
          <b>Hooks</b>
          <b>Status</b>
          <b></b>
        </div>
        {rows.map((item) => {
          const dramaAssets = groupedAssets.get(item.id) || [],
            published = dramaAssets.filter(
              (asset) => asset.status === "published",
            ).length,
            failed = dramaAssets.filter(
              (asset) => asset.status === "failed",
            ).length,
            selectedEpisodes = episodeSelections[item.id] || [];
          return (
            <details className={`drama-library-row${item.id===sourceId?" current":""}`} key={item.id} open={expandedLibraryIds.includes(item.id)} onToggle={(event)=>{const open=event.currentTarget.open;setExpandedLibraryIds((ids)=>open?ids.includes(item.id)?ids:[...ids,item.id]:ids.filter((id)=>id!==item.id));}}>
              <summary onClick={()=>{if(item.id!==sourceId){setSourceId(item.id);setEpisodes([]);}}}>
                <span className="hook-drama-cell">
                  <img src={item.coverUrl} alt="" />
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.slug}</small>
                  </div>
                </span>
                <span>
                  <b>
                    {item.analyzedEpisodes.length}/{item.episodes.length}{" "}
                    generated
                  </b>
                  <small>
                    {item.analyzedEpisodes.length
                      ? `EP ${item.analyzedEpisodes.join(", ")}`
                      : "No successful generation yet"}
                  </small>
                </span>
                <span>
                  <b>{dramaAssets.length} saved</b>
                  <small>
                    {published ? `${published} published` : "Not published yet"}
                  </small>
                </span>
                <span>
                  {failed ? (
                    <em className="asset-status failed">{failed} failed</em>
                  ) : dramaAssets.length ? (
                    <em className="asset-status ready">Hooks ready</em>
                  ) : (
                    <em className="asset-status">Ready to generate</em>
                  )}
                </span>
                <span>Open</span>
              </summary>
              <div className="drama-library-expanded">
                <section>
                  <div className="expanded-heading">
                    <div>
                      <b>Episodes</b>
                      <small>
                        Select up to 15, preview if needed, then generate every
                        qualified hook up to a maximum of 6.
                      </small>
                    </div>
                    <button
                      disabled={!selectedEpisodes.length}
                      onClick={() => useForGeneration(item)}
                    >
                      Generate selected ({selectedEpisodes.length})
                    </button>
                  </div>
                  <div className="episode-selection-grid">
                    {item.episodes.map((episode) => {
                      const analyzed = item.analyzedEpisodes.includes(
                          episode.episodeNumber,
                        ),
                        checked = selectedEpisodes.includes(
                          episode.episodeNumber,
                        );
                      return (
                        <article
                          className={analyzed ? "analyzed" : ""}
                          key={episode.episodeNumber}
                        >
                          <label>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                toggleLibraryEpisode(
                                  item.id,
                                  episode.episodeNumber,
                                )
                              }
                            />
                            EP {episode.episodeNumber}
                            <small>
                              {analyzed ? "Generated" : "Not generated"}
                            </small>
                          </label>
                          <button
                            onClick={() =>
                              setEpisodePreview((current) =>
                                current?.sourceId === item.id &&
                                current.episode.episodeNumber ===
                                  episode.episodeNumber
                                  ? null
                                  : { sourceId: item.id, episode },
                              )
                            }
                          >
                            <Eye /> Preview
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  {episodePreview?.sourceId === item.id && (
                    <div className="episode-preview">
                      <video
                        src={episodePreview.episode.videoUrl}
                        controls
                        preload="metadata"
                        playsInline
                      />
                      <span>
                        Original episode · EP{" "}
                        {episodePreview.episode.episodeNumber}
                      </span>
                    </div>
                  )}
                </section>
                <section>
                  <div className="expanded-heading">
                    <div>
                      <b>Generated hooks</b>
                      <small>
                        Episodes / Generator / Status. Click a hook to review.
                      </small>
                    </div>
                  </div>
                  {dramaAssets.length ? (
                    <>
                      <div className="drama-hooks-head">
                        <b>Hook</b>
                        <b>Episodes</b>
                        <b>Generator</b>
                        <b>Status</b>
                      </div>
                      {dramaAssets.map((asset) => (
                        <div key={`${asset.kind}-${asset.id}`}>
                          <button
                            className={`drama-hook-row${selectedId === asset.id ? " selected" : ""}`}
                            onClick={() =>
                              setSelectedId(
                                selectedId === asset.id ? null : asset.id,
                              )
                            }
                          >
                            <span>{asset.title}</span>
                            <span>EP {asset.sourceEpisodes.join(", ")}</span>
                            <span>{asset.generator}</span>
                            <span>
                              <em className={`asset-status ${asset.status}`}>
                                {statusLabel[asset.status]}
                              </em>
                            </span>
                          </button>
                          {selectedId === asset.id && (
                            <div className="hook-preview">
                              <ReviewVideo src={asset.videoUrl} />
                              <div>
                                <span
                                  className={`asset-status ${asset.status}`}
                                >
                                  {statusLabel[asset.status]}
                                </span>
                                <h3>{asset.title}</h3>
                                <p>
                                  {asset.generator} · EP{" "}
                                  {asset.sourceEpisodes.join(", ")} ·{" "}
                                  {asset.durationSeconds.toFixed(1)}s
                                </p>
                                <a
                                  className="hook-publish-link"
                                  href={`/admin/publish?sourceId=${encodeURIComponent(item.id)}&kind=hook&asset=${encodeURIComponent(asset.id)}`}
                                >
                                  Publish in Publish Center
                                </a>
                                <button
                                  onClick={() => void remove(asset)}
                                  disabled={
                                    busy ||
                                    [
                                      "published",
                                      "publishing",
                                      "scheduled",
                                    ].includes(asset.status)
                                  }
                                >
                                  <Trash2 /> Delete hook
                                </button>
                                {[
                                  "published",
                                  "publishing",
                                  "scheduled",
                                ].includes(asset.status) && (
                                  <small>
                                    Active publishing assets cannot be deleted.
                                  </small>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="hook-library-empty">
                      No hooks generated yet.
                    </p>
                  )}
                </section>
              </div>
            </details>
          );
        })}
        <div className="hook-pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft /> Previous
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            disabled={page === pages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next <ChevronRight />
          </button>
        </div>
      </section>
      <details className="hook-generator" ref={generatorRef} open>
        <summary>
          <div>
            <span>02 · Generate tools</span>
            <h2>Create hooks</h2>
          </div>
          <small>
            Built-in and Vizard are two generation methods. Successful results
            save automatically.
          </small>
        </summary>
        <div className="generator-tabs">
          <button
            className={method === "built-in" ? "active" : ""}
            onClick={() => setMethod("built-in")}
          >
            <Scissors /> Built-in
          </button>
          <button
            className={method === "vizard" ? "active" : ""}
            onClick={() => setMethod("vizard")}
          >
            <Play /> Vizard
          </button>
        </div>
        {method === "vizard" ? (
          <VizardStudio
            sources={sources}
            initialSourceId={sourceId}
            selectedEpisodeNumbers={episodes}
          />
        ) : (
          <div className="built-in-generator">
            <div className="generator-selected-drama"><img src={source?.coverUrl} alt=""/><div><small>Selected drama</small><b>{source?.title}</b></div><button type="button" onClick={()=>document.querySelector(".drama-hook-library")?.scrollIntoView({behavior:"smooth",block:"start"})}>Choose from library ↑</button></div>
            <div>
              <b>Episodes · up to 15 · maximum 6 qualified hooks</b>
              <div className="generator-episodes">
                {source?.episodes.map((episode) => (
                  <label
                    className={
                      episodes.includes(episode.episodeNumber) ? "selected" : ""
                    }
                    key={episode.episodeNumber}
                  >
                    <input
                      type="checkbox"
                      checked={episodes.includes(episode.episodeNumber)}
                      onChange={() => toggleEpisode(episode.episodeNumber)}
                    />
                    EP {episode.episodeNumber}
                    {source.analyzedEpisodes.includes(
                      episode.episodeNumber,
                    ) && <Check />}
                  </label>
                ))}
              </div>
            </div>
            <details className="direction-options">
              <summary>
                Advanced direction <small>Optional · guide scene selection</small>
              </summary>
              <textarea
                value={direction}
                onChange={(event) => setDirection(event.target.value)}
                maxLength={1200}
                placeholder={'描述你想找的片段，例如：\n男女主单独相处、关系暧昧或互相表白。必须包含 love、kiss 或 jealous 等相关对白。避免打斗。停在关系揭晓前。\n\n也可限制时间：从 02:15 开始后面的剧情；或只看 02:15–03:10 内的剧情。'}
              />
              <small>{direction.length}/1200</small>
            </details>
            <button
              className="generate-submit"
              onClick={() => void generate()}
              disabled={busy || !episodes.length}
            >
              {busy ? <LoaderCircle className="spin" /> : <Scissors />}
              {busy ? "Starting…" : "Generate & auto-save"}
            </button>
            {job && (
              <div className={`generation-status ${job.status}`}>
                <b>{job.status.replaceAll("_", " ")}</b>
                <span>{job.progress}%</span>
                {job.errorMessage && <small>{job.errorMessage}</small>}
              </div>
            )}
            {error && <div className="form-error">{error}</div>}
          </div>
        )}
      </details>
      <section className="hook-generation-history">
        <div className="hook-section-title"><div><span>03 · Hook generation history</span><h2>Recent generation tasks</h2></div><div><b>{generationHistory.length}</b><small>Built-in + Vizard</small></div></div>
        <div className="hook-history-head"><b>Task</b><b>Generator</b><b>Progress</b><b>Result</b></div>
        {generationHistory.slice((historyPage-1)*5,historyPage*5).map(item=><button className="hook-history-row" key={`${item.method}-${item.id}`} onClick={()=>openGenerationHistory(item)}><span><img src={item.coverUrl} alt=""/><i><strong>{item.dramaTitle}</strong><small>EP {item.sourceEpisodes.join(", ")} · {new Date(item.createdAt).toLocaleString()}</small></i></span><span>{item.method}</span><span><b>{item.progress}%</b><small>{item.status.replaceAll("_"," ")}</small></span><span className={item.status==="failed"?"failed":item.status==="ready"||item.status==="review_ready"?"ready":""}><b>{item.resultCount} hook{item.resultCount===1?"":"s"}</b><small>{item.errorMessage||"Open task"}</small></span></button>)}
        {!generationHistory.length&&<p className="hook-library-empty">No hook generation history yet.</p>}
        {generationHistory.length>5&&<div className="hook-pagination"><button disabled={historyPage===1} onClick={()=>setHistoryPage(value=>value-1)}><ChevronLeft/> Previous</button><span>{historyPage} / {Math.ceil(generationHistory.length/5)}</span><button disabled={historyPage===Math.ceil(generationHistory.length/5)} onClick={()=>setHistoryPage(value=>value+1)}>Next <ChevronRight/></button></div>}
      </section>
    </div>
  );
}
