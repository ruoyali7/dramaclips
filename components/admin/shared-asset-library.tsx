"use client";
type Asset = { id: string; title: string; videoUrl: string; episodeNumber: number; durationSeconds: number };
export function SharedAssetLibrary({ assets }: { assets: Asset[] }) {
  return <section className="shared-asset-library"><div><span>Shared asset library</span><h2>Drama videos</h2><small>Same R2 assets used by Hook Studio and Publish Center.</small></div>{assets.length ? <div className="shared-asset-grid">{assets.map((asset) => <article key={asset.id}><video src={asset.videoUrl} controls preload="metadata" playsInline/><b>{asset.title}</b><small>Vizard clip · EP {asset.episodeNumber} · {Math.round(asset.durationSeconds)}s</small><a href="/admin/publish">Use in Publish Center →</a></article>)}</div> : <p>No Vizard clips imported yet.</p>}</section>;
}
