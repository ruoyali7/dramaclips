import { PosterPublisher } from "@/components/admin/poster-publisher";
import { AdminShell } from "@/components/admin/admin-shell";
import { listVizardSources } from "@/lib/admin/repository";
import "../poster-publisher.css";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sources = await listVizardSources();
  return <AdminShell active="Poster Publisher"><div className="admin-title"><div><p>Manual social publishing</p><h1>Poster Publisher</h1></div></div><PosterPublisher sources={sources.map((source) => ({ id: source.id, title: source.title, slug: source.slug, publicCode: source.publicCode, coverUrl: source.coverUrl }))} /></AdminShell>;
}
