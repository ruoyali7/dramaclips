import {Download} from "lucide-react";
import {AdminShell} from "@/components/admin/admin-shell";
import {PublishCenter} from "@/components/admin/publish-center";
import {listVizardSources} from "@/lib/admin/repository";
import {listHookClips} from "@/lib/admin/hook-repository";
export const dynamic="force-dynamic";
export default async function Page(){const base=await listVizardSources();const hooks=await listHookClips();const sources=base.map(source=>({...source,hooks:hooks.filter(hook=>hook.dramaSlug===source.slug)}));const metricoolReady=Boolean(process.env.METRICOOL_API_TOKEN&&process.env.METRICOOL_USER_ID&&process.env.METRICOOL_BLOG_ID);return <AdminShell active="Publish Center"><div className="admin-title"><div><p>Final distribution</p><h1>Publish Center</h1></div></div><div className="publish-intro"><div><b>Choose the exact asset to distribute.</b><p>Select an original R2 episode, a Hook Studio edit, or upload another finished video.</p></div><a href="/api/admin/publish-packages/latest/csv" download><Download/> Download latest Metricool CSV</a></div><PublishCenter sources={sources} metricoolReady={metricoolReady}/></AdminShell>}
