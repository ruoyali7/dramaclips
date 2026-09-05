import type { ReactNode } from "react";
import { Eye } from "lucide-react";

export type DramaLibraryEpisode = { episodeNumber: number; videoUrl: string; generated: boolean };
export type DramaLibraryHook = { id: string; title: string; episodes: number[]; generator: string; status: string };

export function DramaLibraryExpanded({ episodes, hooks, selectedEpisodes = [], previewEpisode, selectedHookId, onToggleEpisode, onPreviewEpisode, onSelectHook, onGenerateSelected, renderHookPreview, actions }: {
  episodes: DramaLibraryEpisode[]; hooks: DramaLibraryHook[]; selectedEpisodes?: number[]; previewEpisode?: number | null; selectedHookId?: string | null;
  onToggleEpisode?: (episodeNumber: number) => void; onPreviewEpisode: (episode: DramaLibraryEpisode) => void; onSelectHook?: (hook: DramaLibraryHook) => void; onGenerateSelected?: () => void; renderHookPreview?: (hook: DramaLibraryHook) => ReactNode; actions?: ReactNode;
}) {
  return <div className="drama-library-expanded shared-drama-library-expanded">
    <section><div className="expanded-heading"><div><b>Episodes</b><small>Select up to 15, preview if needed, then use the exact episode asset.</small></div>{onGenerateSelected && <button disabled={!selectedEpisodes.length} onClick={onGenerateSelected}>Generate selected ({selectedEpisodes.length})</button>}</div><div className="episode-selection-grid">{episodes.map((episode) => <article className={episode.generated ? "analyzed" : ""} key={episode.episodeNumber}><label>{onToggleEpisode && <input type="checkbox" checked={selectedEpisodes.includes(episode.episodeNumber)} onChange={() => onToggleEpisode(episode.episodeNumber)} />}EP {episode.episodeNumber}<small>{episode.generated ? "Generated" : "Not generated"}</small></label><button onClick={() => onPreviewEpisode(episode)}><Eye /> Preview</button></article>)}</div>{previewEpisode != null && episodes.filter((episode) => episode.episodeNumber === previewEpisode).map((episode) => <div className="episode-preview" key={episode.episodeNumber}><video src={episode.videoUrl} controls preload="metadata" playsInline/><span>Original episode · EP {episode.episodeNumber}</span></div>)}</section>
    <section><div className="expanded-heading"><div><b>Generated hooks</b><small>Episodes / Generator / Status. Click a hook to review.</small></div></div>{hooks.length ? <><div className="drama-hooks-head"><b>Hook</b><b>Episodes</b><b>Generator</b><b>Status</b></div>{hooks.map((hook) => <div key={hook.id}><button className={`drama-hook-row${selectedHookId === hook.id ? " selected" : ""}`} onClick={() => onSelectHook?.(hook)}><span>{hook.title}</span><span>EP {hook.episodes.join(", ")}</span><span>{hook.generator}</span><span><em className={`asset-status ${hook.status.toLowerCase().replaceAll(" ", "-")}`}>{hook.status}</em></span></button>{selectedHookId === hook.id && renderHookPreview?.(hook)}</div>)}</> : <p className="hook-library-empty">No hooks generated yet.</p>}</section>{actions}
  </div>;
}
