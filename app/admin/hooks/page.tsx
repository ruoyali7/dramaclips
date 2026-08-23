import {AdminShell} from "@/components/admin/admin-shell";
import {HookStudioDashboard} from "@/components/admin/hook-studio-dashboard";
import {listHookClips} from "@/lib/admin/hook-repository";
import {listHookJobs} from "@/lib/admin/hook-job-repository";
import {listPublishPackages} from "@/lib/admin/publish-repository";
import {listVizardSources} from "@/lib/admin/repository";
import {listVizardAssets,listVizardProjects} from "@/lib/admin/vizard-repository";
import "./library.css";

export const dynamic="force-dynamic";
type AssetStatus="published"|"publishing"|"scheduled"|"failed"|"ready";
function statusFor(packages:Awaited<ReturnType<typeof listPublishPackages>>,id:string|undefined,url:string):AssetStatus{const relevant=packages.filter(item=>(id&&item.hookClipId===id)||item.videoUrl===url);for(const status of ["published","publishing","scheduled","failed"] as const)if(relevant.some(item=>item.status===status))return status;return"ready"}
export default async function Page(){
 const [sources,clips,jobs,vizardAssets,vizardProjects,packages]=await Promise.all([listVizardSources(),listHookClips(),listHookJobs(undefined,100),listVizardAssets(),listVizardProjects(),listPublishPackages()]);
 const sourceMap=new Map(sources.map(source=>[source.slug,source]));const savedCandidateIds=new Set(clips.map(clip=>clip.candidateId).filter(Boolean));
 const assets=[
  ...clips.map(clip=>{const source=sourceMap.get(clip.dramaSlug)!;return{id:clip.id,kind:"clip" as const,dramaId:source?.id||"",dramaSlug:clip.dramaSlug,dramaTitle:source?.title||clip.dramaSlug,coverUrl:source?.coverUrl||"",title:clip.title,sourceEpisodes:clip.sourceEpisodes,videoUrl:clip.videoUrl,durationSeconds:clip.durationSeconds,generator:"Built-in" as const,status:statusFor(packages,clip.id,clip.videoUrl),createdAt:clip.createdAt}}),
  ...jobs.flatMap(job=>job.candidates.filter(candidate=>candidate.draftUrl&&!savedCandidateIds.has(candidate.id)).map(candidate=>{const source=sourceMap.get(job.dramaSlug);return{id:candidate.id,kind:"candidate" as const,jobId:job.id,dramaId:job.dramaId,dramaSlug:job.dramaSlug,dramaTitle:source?.title||job.dramaSlug,coverUrl:source?.coverUrl||"",title:candidate.title,sourceEpisodes:job.sourceEpisodes,videoUrl:candidate.draftUrl!,durationSeconds:candidate.durationSeconds||0,generator:"Built-in" as const,status:statusFor(packages,undefined,candidate.draftUrl!),createdAt:job.createdAt}})),
  ...vizardAssets.map(asset=>{const source=sourceMap.get(asset.dramaSlug);return{id:asset.id,kind:"vizard" as const,dramaId:source?.id||"",dramaSlug:asset.dramaSlug,dramaTitle:source?.title||asset.dramaSlug,coverUrl:source?.coverUrl||"",title:asset.title,sourceEpisodes:[asset.episodeNumber],videoUrl:asset.videoUrl,durationSeconds:asset.durationSeconds,generator:"Vizard" as const,status:statusFor(packages,undefined,asset.videoUrl),createdAt:asset.createdAt}})
 ].filter(asset=>asset.dramaId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const analyzed=new Map<string,Set<number>>();const mark=(dramaId:string,numbers:number[])=>{const set=analyzed.get(dramaId)||new Set<number>();numbers.forEach(number=>set.add(number));analyzed.set(dramaId,set)};for(const asset of assets)mark(asset.dramaId,asset.sourceEpisodes);for(const job of jobs)if(job.status==="review_ready")mark(job.dramaId,job.sourceEpisodes);for(const project of vizardProjects)if(project.status==="ready")mark(project.dramaId,[project.episodeNumber]);
 const dashboardSources=sources.map(source=>({...source,analyzedEpisodes:Array.from(analyzed.get(source.id)||[]).sort((a,b)=>a-b)}));
 return <AdminShell active="Hook Studio"><div className="admin-title"><div><p>Hook operations</p><h1>Hook Studio</h1></div></div><HookStudioDashboard sources={dashboardSources} assets={assets}/></AdminShell>
}
