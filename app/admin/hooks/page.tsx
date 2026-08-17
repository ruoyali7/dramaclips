import {AdminShell} from "@/components/admin/admin-shell";
import {HookStudio} from "@/components/admin/hook-studio";
import {VizardStudio} from "@/components/admin/vizard-studio";
import {listHookClips} from "@/lib/admin/hook-repository";
import {listVizardSources} from "@/lib/admin/repository";
import "./library.css";

export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{dramaId?:string}>}){
  const [base,hooks]=await Promise.all([listVizardSources(),listHookClips()]);
  const sources=base.map(source=>({...source,hooks:hooks.filter(hook=>hook.dramaSlug===source.slug)}));
  const {dramaId}=await searchParams;
  return <AdminShell active="Hook Studio"><div className="admin-title"><div><p>In-house social editing</p><h1>Hook Studio</h1></div></div><HookStudio sources={sources} initialSourceId={dramaId}/><details className="additional-tool" id="vizard"><summary><span><b>Additional tool</b>Vizard batch clipping</span><small>Open only when you need the external clipping fallback</small></summary><VizardStudio sources={sources}/></details></AdminShell>;
}
