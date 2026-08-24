"use client";

import {
  Ban,
  Check,
  Eye,
  ExternalLink,
  Film,
  LoaderCircle,
  RefreshCw,
  Scissors,
  UploadCloud,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SavedHook = {
  id: string;
  title: string;
  sourceEpisodes: number[];
  videoUrl: string;
  durationSeconds: number;
};
type VizardDraft = {
  id: string;
  title: string;
  sourceEpisodes: number[];
  videoUrl: string;
  durationSeconds: number;
};
type Source = {
  id: string;
  title: string;
  slug: string;
  coverUrl: string;
  episodes: { episodeNumber: number; videoUrl: string }[];
  hooks: SavedHook[];
  vizardDrafts: VizardDraft[];
  latestJob?: Job;
  analyzedEpisodes: number[];
};
type DirectionEvidence = {
  matched?: string[];
  missing?: string[];
  excluded?: string[];
};
type Candidate = {
  id: string;
  rank: number;
  title: string;
  hookType: string;
  sourceRanges: { episodeNumber: number; start: number; end: number }[];
  score: number;
  scoreComponents: Record<string, number>;
  rationale: string;
  riskLevel: string;
  directionMatchScore?: number;
  directionEvidence?: DirectionEvidence;
  coverSourceTimestamp: number;
  draftUrl?: string;
  reviewState: "pending" | "approved" | "rejected";
};
type Job = {
  id: string;
  sourceEpisodes: number[];
  creativeDirection?: string;
  createdAt: string;
  status:
    | "queued"
    | "downloading"
    | "transcribing"
    | "analyzing"
    | "rendering"
    | "review_ready"
    | "no_result"
    | "failed"
    | "canceled";
  progress: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  candidates: Candidate[];
};
const terminal = new Set(["review_ready", "no_result", "failed", "canceled"]);

export function HookStudio({
  sources,
  initialSourceId,
}: {
  sources: Source[];
  initialSourceId?: string;
}) {
  const [sourceId, setSourceId] = useState(
    sources.some((item) => item.id === initialSourceId)
      ? initialSourceId!
      : sources[0]?.id || "",
  );
  const source = sources.find((item) => item.id === sourceId);
  const [selectedEpisodeNumbers, setSelectedEpisodeNumbers] = useState<
    number[]
  >(source?.episodes[0] ? [source.episodes[0].episodeNumber] : []);
  const [direction, setDirection] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<Job[]>([]);
  const [restoring, setRestoring] = useState(true);
  const [busy, setBusy] = useState(false);
  const [forceNew, setForceNew] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [libraryFilter, setLibraryFilter] = useState<
    "all" | "needs-hooks" | "has-hooks"
  >("all");
  const builderRef = useRef<HTMLElement>(null);
  const reviewRef = useRef<HTMLElement>(null);
  const libraryIntent = useRef<"default" | "generate" | "review">("default");
  const selected = useMemo(
    () =>
      source?.episodes.filter((item) =>
        selectedEpisodeNumbers.includes(item.episodeNumber),
      ) || [],
    [source, selectedEpisodeNumbers],
  );
  const librarySources = useMemo(
    () =>
      sources.filter(
        (item) =>
          libraryFilter === "all" ||
          (libraryFilter === "has-hooks"
            ? item.hooks.length > 0
            : item.hooks.length === 0),
      ),
    [sources, libraryFilter],
  );
  const episodeTotal = useMemo(
    () => sources.reduce((total, item) => total + item.episodes.length, 0),
    [sources],
  );
  const hookTotal = useMemo(
    () => sources.reduce((total, item) => total + item.hooks.length, 0),
    [sources],
  );

  useEffect(() => {
    let active = true;
    setRestoring(true);
    fetch(`/api/admin/hooks/jobs?dramaId=${encodeURIComponent(sourceId)}`, {
      cache: "no-store",
    })
      .then((response) =>
        response.json().then((json) => ({ ok: response.ok, json })),
      )
      .then(({ ok, json }) => {
        if (!active) return;
        if (!ok) throw new Error(json.message || "Could not restore jobs");
        const jobs: Job[] = json.jobs || [];
        const restore = libraryIntent.current === "default";
        setHistory(jobs);
        setJob(restore ? jobs[0] || null : null);
        setDirection(restore ? jobs[0]?.creativeDirection || "" : "");
        if (restore && jobs[0]?.sourceEpisodes?.length)
          setSelectedEpisodeNumbers(jobs[0].sourceEpisodes);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error ? reason.message : "Could not restore jobs",
          );
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => {
      active = false;
    };
  }, [sourceId]);
  useEffect(() => {
    if (!job || terminal.has(job.status)) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/admin/hooks/jobs?id=${encodeURIComponent(job.id)}`,
          { cache: "no-store" },
        );
        const json = await response.json();
        if (response.ok) {
          setJob(json.job);
          setHistory((items) =>
            items.map((item) => (item.id === json.job.id ? json.job : item)),
          );
        }
      } catch {}
    }, 2500);
    return () => window.clearInterval(timer);
  }, [job]);

  function selectJob(next: Job | null) {
    setShowSaved(false);
    setJob(next);
    setForceNew(!next);
    setDirection(next?.creativeDirection || "");
    if (next?.sourceEpisodes.length)
      setSelectedEpisodeNumbers(next.sourceEpisodes);
    setSaved([]);
  }
  function changeSource(
    id: string,
    intent: "default" | "generate" | "review" = "default",
  ) {
    libraryIntent.current = intent;
    setSourceId(id);
    const next = sources.find((item) => item.id === id);
    setSelectedEpisodeNumbers(
      next?.episodes[0] ? [next.episodes[0].episodeNumber] : [],
    );
    setDirection("");
    setJob(null);
    setHistory([]);
    setError("");
    setSaved([]);
    setShowSaved(intent === "review");
  }
  function chooseFromLibrary(id: string, mode: "generate" | "review") {
    libraryIntent.current = mode;
    if (id !== sourceId) changeSource(id, mode);
    if (mode === "generate") {
      setShowSaved(false);
      setJob(null);
      setForceNew(true);
    } else {
      setShowSaved(true);
      setJob(null);
      setForceNew(false);
    }
    window.setTimeout(() => {
      (mode === "generate" ? builderRef : reviewRef).current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }
  function reviewDraft(item: Source) {
    libraryIntent.current = "default";
    if (item.id !== sourceId) changeSource(item.id);
    setShowSaved(false);
    setJob(item.latestJob || null);
    setDirection(item.latestJob?.creativeDirection || "");
    if (item.latestJob?.sourceEpisodes.length)
      setSelectedEpisodeNumbers(item.latestJob.sourceEpisodes);
    window.setTimeout(
      () =>
        reviewRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        }),
      50,
    );
  }
  function toggleEpisode(episodeNumber: number) {
    setSelectedEpisodeNumbers((items) =>
      items.includes(episodeNumber)
        ? items.filter((item) => item !== episodeNumber)
        : items.length < 15
          ? [...items, episodeNumber].sort((a, b) => a - b)
          : items,
    );
  }
  function libraryJob(item: Source) {
    return item.id === sourceId && job ? job : item.latestJob;
  }
  function draftCandidates(item: Source) {
    return (libraryJob(item)?.candidates || []).filter(
      (candidate) => candidate.reviewState === "pending" && candidate.draftUrl,
    );
  }
  async function createJob() {
    if (!source || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/hooks/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dramaId: source.id,
          episodeNumbers: selected.map((item) => item.episodeNumber),
          forceNew,
          settings: {
            maxHooks: 6,
            coverDuration: 0.1,
            hookTitle: true,
            creativeDirection: direction,
          },
        }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Could not create job");
      setJob(json.job);
      setForceNew(false);
      setHistory((items) => [
        json.job,
        ...items.filter((item) => item.id !== json.job.id),
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create job",
      );
    } finally {
      setBusy(false);
    }
  }
  async function action(value: "cancel" | "retry") {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/hooks/jobs/${job.id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: value }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Could not update job");
      setJob(json.job);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not update job",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(candidate: Candidate) {
    if (!job) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/hooks/jobs/${job.id}/candidates/${candidate.id}/save`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: candidate.title }),
        },
      );
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Could not save hook");
      setSaved((items) => [...items, candidate.id]);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save hook",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(candidate: Candidate) {
    if (
      !job ||
      !window.confirm(
        "Delete this unapproved hook draft? This removes the draft file and review record.",
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/hooks/jobs/${job.id}/candidates/${candidate.id}`,
        { method: "DELETE" },
      );
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.message || "Could not delete hook draft");
      setJob((current) =>
        current
          ? {
              ...current,
              candidates: current.candidates.filter(
                (item) => item.id !== candidate.id,
              ),
            }
          : current,
      );
      setHistory((items) =>
        items.map((item) =>
          item.id === job.id
            ? {
                ...item,
                candidates: item.candidates.filter(
                  (item) => item.id !== candidate.id,
                ),
              }
            : item,
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not delete hook draft",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reviewVizard(
    candidate: VizardDraft,
    action: "approve" | "delete",
  ) {
    if (
      action === "delete" &&
      !window.confirm("Delete this unapproved Vizard hook?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/vizard/assets/${candidate.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.message || "Could not review Vizard hook");
      window.location.reload();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not review Vizard hook",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!sources.length)
    return (
      <div className="admin-empty">
        <Film />
        <h2>No published dramas</h2>
      </div>
    );
  return (
    <div className="hook-studio">
      <section className="hook-builder" ref={builderRef}>
        <span>01 · Source & durable job</span>
        <label>
          <b>Drama</b>
          <select
            value={sourceId}
            onChange={(event) => changeSource(event.target.value)}
            disabled={busy || Boolean(job && !terminal.has(job.status))}
          >
            {sources.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>
        {history.length > 0 && (
          <label>
            <b>Previous jobs</b>
            <select
              value={job?.id || ""}
              onChange={(event) =>
                selectJob(
                  history.find((item) => item.id === event.target.value) ||
                    null,
                )
              }
            >
              {history.map((item) => (
                <option value={item.id} key={item.id}>
                  {new Date(item.createdAt).toLocaleString()} ·{" "}
                  {item.status.replaceAll("_", " ")} · EP{" "}
                  {item.sourceEpisodes.join(", ")}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="episode-selector">
          <b>Select episodes to analyze · up to 15 · maximum 6 qualified hooks</b>
          <div>
            {source?.episodes.map((item) => (
              <label
                className={
                  selectedEpisodeNumbers.includes(item.episodeNumber)
                    ? "selected"
                    : ""
                }
                key={item.episodeNumber}
              >
                <input
                  type="checkbox"
                  checked={selectedEpisodeNumbers.includes(item.episodeNumber)}
                  disabled={
                    busy ||
                    Boolean(job && !terminal.has(job.status)) ||
                    (!selectedEpisodeNumbers.includes(item.episodeNumber) &&
                      selectedEpisodeNumbers.length >= 15)
                  }
                  onChange={() => toggleEpisode(item.episodeNumber)}
                />
                EP {item.episodeNumber}
              </label>
            ))}
          </div>
          <small>{selectedEpisodeNumbers.length}/15 selected</small>
        </div>
        <label className="hook-direction">
          <b>Hook direction / 想突出的重点</b>
          <textarea
            value={direction}
            onChange={(event) => setDirection(event.target.value)}
            maxLength={1200}
            disabled={busy || Boolean(job)}
            placeholder="例如：突出禁忌暧昧、嫉妒和带双关的对白；保持平台安全；不要揭露结局；停在亲密动作完成之前。"
          />
          <small>
            {direction.length}/1200 · 留空时使用默认 grounded style。Direction
            决定找什么，质量评分决定是否值得剪。
          </small>
        </label>
        <div className="cover-rule">
          <b>Frame-zero cover · 0.10 seconds</b>
          <p>
            Three frames at 30 fps are encoded as the true opening keyframe. The
            narrative audio starts with the main clip.
          </p>
        </div>
        {restoring ? (
          <div className="hook-placeholder">
            <LoaderCircle className="spin" />
            <b>Restoring recent jobs…</b>
          </div>
        ) : !job ? (
          <button
            className="save-draft"
            onClick={() => void createJob()}
            disabled={busy || !selected.length}
          >
            {busy ? <LoaderCircle className="spin" /> : <Scissors />}
            {busy ? "Creating job…" : "Start making hooks"}
          </button>
        ) : (
          <div className="hook-job">
            <div>
              <b>{job.status.replaceAll("_", " ")}</b>
              <span>{job.progress}%</span>
            </div>
            <i style={{ width: `${job.progress}%` }} />
            <small>Job {job.id}</small>
            {terminal.has(job.status) && (
              <button onClick={() => selectJob(null)} disabled={busy}>
                <Scissors /> New job
              </button>
            )}
            {!terminal.has(job.status) && (
              <button onClick={() => void action("cancel")} disabled={busy}>
                <Ban /> Cancel
              </button>
            )}
            {(job.status === "failed" || job.status === "canceled") &&
              job.retryCount < job.maxRetries && (
                <button onClick={() => void action("retry")} disabled={busy}>
                  <RefreshCw /> Retry safely
                </button>
              )}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
      </section>
      <section className="hook-results" ref={reviewRef}>
        <span>02 · Review</span>
        {source?.vizardDrafts.map((candidate) => (
          <article key={candidate.id}>
            <div>
              <b>VIZARD · {candidate.title}</b>
              <small>
                EP {candidate.sourceEpisodes.join(", ")} · pending review
              </small>
            </div>
            <video
              src={candidate.videoUrl}
              controls
              preload="metadata"
              playsInline
            />
            <button
              onClick={() => void reviewVizard(candidate, "approve")}
              disabled={busy}
            >
              <Check />
              Approve
            </button>
            <button
              className="delete-draft"
              onClick={() => void reviewVizard(candidate, "delete")}
              disabled={busy}
            >
              Delete
            </button>
          </article>
        ))}
        {showSaved ? (
          <div className="saved-hook-grid">
            {source?.hooks.map((hook) => (
              <article key={hook.id}>
                <div>
                  <b>{hook.title}</b>
                  <small>
                    EP {hook.sourceEpisodes.join(", ")} · {hook.durationSeconds}
                    s · saved to R2
                  </small>
                </div>
                <video
                  src={hook.videoUrl}
                  controls
                  preload="metadata"
                  playsInline
                />
              </article>
            ))}
          </div>
        ) : !job ? (
          <div className="hook-placeholder">
            <Film />
            <b>Up to two qualified hooks</b>
            <p>Recent jobs and their exact direction restore automatically.</p>
          </div>
        ) : job.status === "no_result" ? (
          <div className="hook-placeholder">
            <Film />
            <b>No grounded candidate matched the direction and quality gate</b>
          </div>
        ) : job.status === "failed" ? (
          <div className="form-error">
            {job.errorMessage || "Worker failed safely."}
          </div>
        ) : job.candidates.length ? (
          job.candidates.map((candidate) => (
            <article key={candidate.id}>
              <div>
                <b>
                  HOOK {candidate.rank} · {candidate.title}
                </b>
                <small>
                  {candidate.hookType} · score {candidate.score} · risk{" "}
                  {candidate.riskLevel}
                  {candidate.directionMatchScore != null
                    ? ` · direction ${candidate.directionMatchScore}`
                    : ""}
                </small>
              </div>
              {candidate.draftUrl && (
                <video
                  src={candidate.draftUrl}
                  controls
                  preload="metadata"
                  playsInline
                />
              )}
              <p>{candidate.rationale}</p>
              {candidate.directionMatchScore != null &&
                candidate.directionEvidence && (
                  <small>
                    Matched:{" "}
                    {candidate.directionEvidence.matched?.join(", ") || "none"}
                    {candidate.directionEvidence.excluded?.length
                      ? ` · Excluded: ${candidate.directionEvidence.excluded.join(", ")}`
                      : ""}
                    {candidate.directionEvidence.missing?.length
                      ? ` · Missing: ${candidate.directionEvidence.missing.join(", ")}`
                      : ""}
                  </small>
                )}
              <small>
                {candidate.sourceRanges
                  .map(
                    (range) =>
                      `EP ${range.episodeNumber} ${range.start.toFixed(1)}–${range.end.toFixed(1)}s`,
                  )
                  .join(" · ")}{" "}
                · cover {candidate.coverSourceTimestamp.toFixed(2)}s
              </small>
              {candidate.draftUrl && (
                <>
                  <button
                    onClick={() => void save(candidate)}
                    disabled={busy || saved.includes(candidate.id)}
                  >
                    {saved.includes(candidate.id) ? <Check /> : <UploadCloud />}
                    {saved.includes(candidate.id)
                      ? "Saved to R2"
                      : "Approve & save to R2"}
                  </button>
                  {candidate.reviewState === "pending" && (
                    <button
                      className="delete-draft"
                      onClick={() => void remove(candidate)}
                      disabled={busy}
                    >
                      Delete draft
                    </button>
                  )}
                </>
              )}
            </article>
          ))
        ) : (
          <div className="hook-placeholder">
            <LoaderCircle className={terminal.has(job.status) ? "" : "spin"} />
            <b>{job.status.replaceAll("_", " ")}</b>
            <p>
              {terminal.has(job.status)
                ? "No reviewable drafts were returned."
                : "The independent worker owns the long-running media work."}
            </p>
          </div>
        )}
      </section>
      <section className="hook-library">
        <span>03 · Drama videos</span>
        <div className="hook-library-summary">
          <span>
            <b>{sources.length}</b>
            <small>Dramas</small>
          </span>
          <span>
            <b>{episodeTotal}</b>
            <small>R2 episodes</small>
          </span>
          <span>
            <b>{hookTotal}</b>
            <small>Saved hooks</small>
          </span>
        </div>
        <div className="hook-library-tools">
          <select
            value={libraryFilter}
            onChange={(event) =>
              setLibraryFilter(event.target.value as typeof libraryFilter)
            }
          >
            <option value="all">All dramas</option>
            <option value="needs-hooks">Needs hooks</option>
            <option value="has-hooks">Has saved hooks</option>
          </select>
          <small>Generate → Review → Save to R2 → Publish Center</small>
        </div>
        <div className="hook-library-head">
          <b>Drama</b>
          <b>Episode coverage</b>
          <b>Hook assets</b>
          <b>Latest job</b>
          <b>Next action</b>
        </div>
        <div className="hook-library-list">
          {librarySources.map((item) => {
            const latest = libraryJob(item);
            const drafts = draftCandidates(item);
            const draftTotal = drafts.length + item.vizardDrafts.length;
            const active = Boolean(latest && !terminal.has(latest.status));
            const next = draftTotal
              ? "Review draft"
              : active
                ? `${latest!.progress}%`
                : item.hooks.length
                  ? "Open hooks"
                  : "Generate";
            return (
              <details
                className={`hook-library-row${item.id === sourceId ? " selected" : ""}`}
                key={item.id}
              >
                <summary>
                  <div className="hook-drama-cell">
                    <img src={item.coverUrl} alt="" />
                    <div>
                      <b>{item.title}</b>
                      <small>{item.slug}</small>
                    </div>
                  </div>
                  <div>
                    <div className="hook-episode-chips">
                      {item.episodes.map((episode) => (
                        <i
                          className={
                            item.analyzedEpisodes.includes(
                              episode.episodeNumber,
                            )
                              ? "analyzed"
                              : ""
                          }
                          key={episode.episodeNumber}
                        >
                          EP {episode.episodeNumber}
                        </i>
                      ))}
                    </div>
                    <small>
                      {item.analyzedEpisodes.length}/{item.episodes.length}{" "}
                      analyzed
                    </small>
                  </div>
                  <div>
                    <b>
                      {item.hooks.length} saved · {draftTotal} draft
                    </b>
                    <small>
                      {draftTotal
                        ? "Waiting for review"
                        : item.hooks.length
                          ? "Ready for publishing"
                          : "No hook assets yet"}
                    </small>
                  </div>
                  <div className="hook-workflow-status">
                    {active ? (
                      <span className="working">
                        {latest!.status.replaceAll("_", " ")} ·{" "}
                        {latest!.progress}%
                      </span>
                    ) : draftTotal ? (
                      <span className="review">Needs review</span>
                    ) : latest?.status === "failed" ? (
                      <span className="failed">Failed</span>
                    ) : item.hooks.length ? (
                      <span className="ready">Hooks ready</span>
                    ) : (
                      <span>Ready to generate</span>
                    )}
                    <small>
                      {latest ? latest.createdAt.slice(0, 10) : "No job yet"}
                    </small>
                  </div>
                  <b className="hook-expand">{next}</b>
                </summary>
                <div className="hook-library-expanded">
                  <div>
                    <b>Episode coverage</b>
                    <div className="hook-video-links">
                      {item.episodes.map((episode) => (
                        <a
                          className={
                            item.analyzedEpisodes.includes(
                              episode.episodeNumber,
                            )
                              ? "analyzed"
                              : ""
                          }
                          href={episode.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          key={episode.episodeNumber}
                        >
                          EP {episode.episodeNumber}
                          <ExternalLink />
                        </a>
                      ))}
                    </div>
                    <p>
                      {item.analyzedEpisodes.length
                        ? `Analyzed EP ${item.analyzedEpisodes.join(", ")}.`
                        : "No episodes analyzed yet."}
                    </p>
                  </div>
                  <div>
                    <b>Hook topics & cover frames</b>
                    {draftTotal ? (
                      <div className="hook-draft-list">
                        {drafts.map((candidate) => (
                          <article key={candidate.id}>
                            <video
                              src={candidate.draftUrl}
                              muted
                              preload="metadata"
                              playsInline
                            />
                            <div>
                              <strong>{candidate.title}</strong>
                              <small>
                                EP{" "}
                                {candidate.sourceRanges
                                  .map((range) => range.episodeNumber)
                                  .join(", ")}{" "}
                                · cover{" "}
                                {candidate.coverSourceTimestamp.toFixed(2)}s ·
                                pending review
                              </small>
                              <button
                                className="delete-draft"
                                onClick={() => void remove(candidate)}
                                disabled={busy}
                              >
                                Delete draft
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : item.hooks.length ? (
                      <div className="hook-saved-list">
                        {item.hooks.map((hook) => (
                          <a
                            href={hook.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            key={hook.id}
                          >
                            <span>{hook.title}</span>
                            <small>
                              EP {hook.sourceEpisodes.join(", ")} ·{" "}
                              {hook.durationSeconds}s
                            </small>
                            <ExternalLink />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p>
                        No hook topics yet. Generate qualified hooks from
                        selected episodes.
                      </p>
                    )}
                  </div>
                  <div className="hook-library-actions">
                    {draftTotal ? (
                      <button onClick={() => reviewDraft(item)}>
                        <Eye /> Review draft
                      </button>
                    ) : active ? (
                      <button disabled>
                        <LoaderCircle className="spin" /> Processing{" "}
                        {latest!.progress}%
                      </button>
                    ) : item.hooks.length ? (
                      <button
                        onClick={() => chooseFromLibrary(item.id, "review")}
                      >
                        <Eye /> Open hooks
                      </button>
                    ) : (
                      <button
                        onClick={() => chooseFromLibrary(item.id, "generate")}
                      >
                        <Scissors /> Generate hooks
                      </button>
                    )}
                    {!active && (
                      <button
                        onClick={() => chooseFromLibrary(item.id, "generate")}
                        disabled={
                          busy || Boolean(job && !terminal.has(job.status))
                        }
                      >
                        <Scissors /> New generation
                      </button>
                    )}
                    {item.hooks.length > 0 && (
                      <a className="hook-publish-link" href="/admin/publish">
                        Use in Publish Center
                      </a>
                    )}
                  </div>
                </div>
              </details>
            );
          })}
          {!librarySources.length && (
            <p className="hook-library-empty">No drama matches this filter.</p>
          )}
        </div>
      </section>
    </div>
  );
}
