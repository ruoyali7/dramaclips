import { AdminShell } from "@/components/admin/admin-shell";
import { VizardStudio } from "@/components/admin/vizard-studio";
import { listVizardSources } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";
export default async function Page() {
  const sources = await listVizardSources();
  return <AdminShell active="Vizard Studio"><div className="admin-title"><div><p>Social clipping</p><h1>Vizard Studio</h1></div></div><VizardStudio sources={sources} /></AdminShell>;
}
