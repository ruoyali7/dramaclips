import {AdminShell} from "@/components/admin/admin-shell";
import {HookStudio} from "@/components/admin/hook-studio";
import {listVizardSources} from "@/lib/admin/repository";
export const dynamic="force-dynamic";
export default async function Page(){const sources=await listVizardSources();return <AdminShell active="Hook Studio"><div className="admin-title"><div><p>In-house social editing</p><h1>Hook Studio</h1></div></div><HookStudio sources={sources}/></AdminShell>}
