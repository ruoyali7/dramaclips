import { PosterPublisher } from "@/components/admin/poster-publisher";
import { AdminShell } from "@/components/admin/admin-shell";
import { listVizardSources } from "@/lib/admin/repository";
import { posterCoverProxyUrl } from "@/lib/admin/poster-cover";
import "../poster-publisher.css";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sources = await listVizardSources();
  return <AdminShell active="Poster Publisher"><div className="admin-title"><div><p>Create assets for manual publishing</p><h1>Poster Publisher</h1></div></div><PosterPublisher sources={sources.map((source) => ({ id: source.id, title: source.title, slug: source.slug, contentCode: source.promoCode || source.publicCode, coverUrl: posterCoverProxyUrl(source.coverUrl), sourceCoverUrl: source.coverUrl, description: source.description, tags: source.tags, contentPromotionUrl: source.contentPromotionUrl }))} /></AdminShell>;
}
