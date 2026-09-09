import type { ReactNode } from "react";
import { Eye } from "lucide-react";

export type DramaLibraryEpisode = { episodeNumber: number; videoUrl: string; generated: boolean };
export type DramaLibraryHook = { id: string; title: string; episodes: number[]; generator: string; status: string; inCart?: boolean };

function hookStatus(status: string) {
  if (status.startsWith("Published")) return { label: "Published", className: "published" };
  if (status === "Scheduled") return { label: "Scheduled", className: "scheduled" };
  if (["Publishing", "Processing", "Submitted · confirming"].includes(status)) return { label: "Publishing", className: "publishing" };
  if (["Failed", "Needs reconciliation", "Canceled"].includes(status)) return { label: status, className: "failed" };
  return { label: "Saved", className: "saved" };
}

export function DramaLibraryExpanded({ episodes, hooks, selectedEpisodes = [], previewEpisode, selectedHookId, onToggleEpisode, onPreviewEpisode, onSelectHook, onAddHookToCart, onGenerateSelected, renderHookPreview, actions }: {
  episodes: DramaLibraryEpisode[]; hooks: DramaLibraryHook[]; selectedEpisodes?: number[]; previewEpisode?: number | null; selectedHookId?: string | null;
  onToggleEpisode?: (episodeNumber: number) => void; onPreviewEpisode: (episode: DramaLibraryEpisode) => void; onSelectHook?: (hook: DramaLibraryHook) => void; onAddHookToCart?: (hook: DramaLibraryHook) => void; onGenerateSelected?: () => void; renderHookPreview?: (hook: DramaLibraryHook) => ReactNode; actions?: ReactNode;
}) {
  return <div className="drama-library-expanded shared-drama-library-expanded">
    <section><div className="expanded-heading"><div><b>Episodes</b><small>Green means a Hook has been generated from this episode; white means no Hook yet.</small></div>{onGenerateSelected && <button disabled={!selectedEpisodes.length} onClick={onGenerateSelected}>Generate selected ({selectedEpisodes.length})</button>}</div><div className="episode-selection-grid">{episodes.map((episode) => <article className={episode.generated ? "analyzed" : ""} key={episode.episodeNumber}><label>{onToggleEpisode && <input type="checkbox" checked={selectedEpisodes.includes(episode.episodeNumber)} onChange={() => onToggleEpisode(episode.episodeNumber)} />}EP {episode.episodeNumber}<small>{episode.generated ? "Hook generated" : "No Hook yet"}</small></label><button onClick={() => onPreviewEpisode(episode)}><Eye /> Preview</button></article>)}</div>{previewEpisode != null && episodes.filter((episode) => episode.episodeNumber === previewEpisode).map((episode) => <div className="episode-preview" key={episode.episodeNumber}><video src={episode.videoUrl} controls preload="metadata" playsInline/><span>Original episode · EP {episode.episodeNumber}</span></div>)}</section>
    <section><div className="expanded-heading"><div><b>Generated hooks</b><small>Gray means saved, purple scheduled, yellow publishing, green published, and red needs attention. Select a Hook to preview it.</small></div></div>{hooks.length ? <><div className="drama-hooks-head"><b>Hook</b><b>Episodes</b><b>Generator</b><b>Status</b><b>Cart</b></div>{hooks.map((hook) => { const status = hookStatus(hook.status); return <div key={hook.id}><div className={`drama-hook-row${selectedHookId === hook.id ? " selected" : ""}`}><button className="hook-review-button" onClick={() => onSelectHook?.(hook)}>{hook.title}<small><Eye /> Preview</small></button><span>EP {hook.episodes.join(", ")}</span><span>{hook.generator}</span><span><em className={`asset-status ${status.className}`}>{status.label}</em></span><button className="hook-cart-button" disabled={hook.inCart} onClick={() => onAddHookToCart?.(hook)}>{hook.inCart ? "Added" : "+ Cart"}</button></div>{selectedHookId === hook.id && renderHookPreview?.(hook)}</div>;})}</> : <p className="hook-library-empty">No hooks generated yet.</p>}</section>{actions}
  </div>;
}
