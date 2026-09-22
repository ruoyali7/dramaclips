import type { ReactNode } from "react";
import { Eye } from "lucide-react";

export type DramaLibraryEpisode = { id: string; episodeNumber: number; videoUrl: string; generated: boolean; inCart?: boolean };
export type DramaLibraryHook = { id: string; title: string; episodes: number[]; generator: string; status: string; inCart?: boolean };

function hookStatus(status: string) {
  if (status.startsWith("Published")) return { label: "Published", className: "published" };
  if (status === "Scheduled") return { label: "Scheduled", className: "scheduled" };
  if (["Publishing", "Processing", "Submitted · confirming"].includes(status)) return { label: "Publishing", className: "publishing" };
  if (["Failed", "Needs reconciliation", "Canceled"].includes(status)) return { label: status, className: "failed" };
  return { label: "Saved", className: "saved" };
}

export function DramaLibraryExpanded({ episodes, hooks, selectedEpisodes = [], previewEpisode, selectedHookId, onToggleEpisode, onPreviewEpisode, onAddEpisodeToCart, onSelectHook, onAddHookToCart, onGenerateSelected, renderHookPreview, actions }: {
  episodes: DramaLibraryEpisode[]; hooks: DramaLibraryHook[]; selectedEpisodes?: number[]; previewEpisode?: number | null; selectedHookId?: string | null;
  onToggleEpisode?: (episodeNumber: number) => void; onPreviewEpisode: (episode: DramaLibraryEpisode) => void; onAddEpisodeToCart?: (episode: DramaLibraryEpisode) => void; onSelectHook?: (hook: DramaLibraryHook) => void; onAddHookToCart?: (hook: DramaLibraryHook) => void; onGenerateSelected?: () => void; renderHookPreview?: (hook: DramaLibraryHook) => ReactNode; actions?: ReactNode;
}) {
  return <div className="drama-library-expanded shared-drama-library-expanded">
    <section><div className="expanded-heading"><div><b>Original episodes</b><small>Publish an original episode directly, or keep using a generated Hook below.</small></div>{onGenerateSelected && <button disabled={!selectedEpisodes.length} onClick={onGenerateSelected}>Generate selected ({selectedEpisodes.length})</button>}</div><div className="episode-selection-grid">{episodes.map((episode) => <article className={episode.generated ? "analyzed" : ""} key={episode.id}><label>{onToggleEpisode && <input type="checkbox" checked={selectedEpisodes.includes(episode.episodeNumber)} onChange={() => onToggleEpisode(episode.episodeNumber)} />}EP {episode.episodeNumber}<small>{episode.generated ? "Hook generated" : "Original ready"}</small></label><div className="episode-actions"><button onClick={() => onPreviewEpisode(episode)}><Eye /> Preview</button>{onAddEpisodeToCart && <button className="episode-cart-button" disabled={episode.inCart} onClick={() => onAddEpisodeToCart(episode)}>{episode.inCart ? "Added" : "+ Cart"}</button>}</div></article>)}</div>{previewEpisode != null && episodes.filter((episode) => episode.episodeNumber === previewEpisode).map((episode) => <div className="episode-preview" key={episode.id}><video src={episode.videoUrl} controls preload="metadata" playsInline/><span>Original episode · EP {episode.episodeNumber}</span></div>)}</section>
    <section><div className="expanded-heading"><div><b>Generated hooks</b><small>Gray means saved, purple scheduled, yellow publishing, green published, and red needs attention. Select a Hook to preview it.</small></div></div>{hooks.length ? <><div className="drama-hooks-head"><b>Hook</b><b>Episodes</b><b>Generator</b><b>Status</b><b>Cart</b></div>{hooks.map((hook) => { const status = hookStatus(hook.status); return <div key={hook.id}><div className={`drama-hook-row${selectedHookId === hook.id ? " selected" : ""}`}><button className="hook-review-button" onClick={() => onSelectHook?.(hook)}>{hook.title}<small><Eye /> Preview</small></button><span>EP {hook.episodes.join(", ")}</span><span>{hook.generator}</span><span><em className={`asset-status ${status.className}`}>{status.label}</em></span><button className="hook-cart-button" disabled={hook.inCart} onClick={() => onAddHookToCart?.(hook)}>{hook.inCart ? "Added" : "+ Cart"}</button></div>{selectedHookId === hook.id && renderHookPreview?.(hook)}</div>;})}</> : <p className="hook-library-empty">No hooks generated yet.</p>}</section>{actions}
  </div>;
}
