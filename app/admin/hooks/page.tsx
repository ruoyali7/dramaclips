import {AdminShell} from "@/components/admin/admin-shell";
import {HookStudio} from "@/components/admin/hook-studio";
import {VizardStudio} from "@/components/admin/vizard-studio";
import {listHookClips} from "@/lib/admin/hook-repository";
import {listHookJobs} from "@/lib/admin/hook-job-repository";
import {listVizardSources} from "@/lib/admin/repository";
import "./library.css";

export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<{dramaId?:string}>}){
  const [base,hooks,jobs]=await Promise.all([listVizardSources(),listHookClips(),listHookJobs(undefined,25)]);
  const sources=base.map(source=>{const sourceJobs=jobs.filter(job=>job.dramaId===source.id);return{...source,hooks:hooks.filter(hook=>hook.dramaSlug===source.slug),latestJob:sourceJobs[0],analyzedEpisodes:Array.from(new Set(sourceJobs.flatMap(job=>job.sourceEpisodes))).sort((a,b)=>a-b)}});
  const {dramaId}=await searchParams;
  return <AdminShell active="Hook Studio"><div className="admin-title"><div><p>In-house social editing</p><h1>Hook Studio</h1></div></div><HookStudio sources={sources} initialSourceId={dramaId}/><details className="additional-tool" id="vizard"><summary><span><b>Additional tool</b>Vizard batch clipping</span><small>Open only when you need the external clipping fallback</small></summary><VizardStudio sources={sources}/></details></AdminShell>;
}
