import {Download} from "lucide-react";
import {AdminShell} from "@/components/admin/admin-shell";
import {PublishCenter} from "@/components/admin/publish-center";
import {listVizardSources} from "@/lib/admin/repository";
import {listHookClips} from "@/lib/admin/hook-repository";
import {yixiaoerConfigured} from "@/lib/admin/yixiaoer";
export const dynamic="force-dynamic";
export default async function Page(){const [base,hooks,yixiaoerReady]=await Promise.all([listVizardSources(),listHookClips(),yixiaoerConfigured()]);const sources=base.map(source=>({...source,hooks:hooks.filter(hook=>hook.dramaSlug===source.slug)}));return <AdminShell active="Publish Center"><div className="admin-title"><div><p>Final distribution</p><h1>Publish Center</h1></div></div><div className="publish-intro"><div><b>Choose the exact asset to distribute.</b><p>Select an R2 video, validate it with Yixiaoer, then explicitly confirm live publishing.</p></div><a href="/api/admin/publish-packages/latest/csv" download><Download/> CSV fallback</a></div><PublishCenter sources={sources} yixiaoerReady={yixiaoerReady}/></AdminShell>}
