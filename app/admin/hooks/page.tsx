import {AdminShell} from "@/components/admin/admin-shell";
import {HookStudioDashboard} from "@/components/admin/hook-studio-dashboard";
import {listHookClips} from "@/lib/admin/hook-repository";
import {listHookJobs} from "@/lib/admin/hook-job-repository";
import {listPublishPackages} from "@/lib/admin/publish-repository";
import {listVizardSources} from "@/lib/admin/repository";
import {listVizardProjects} from "@/lib/admin/vizard-repository";
import {listLibraryAssets} from "@/lib/admin/asset-library";
import "./library.css";

export const dynamic="force-dynamic";
type AssetStatus="published"|"publishing"|"scheduled"|"failed"|"ready";
function statusFor(packages:Awaited<ReturnType<typeof listPublishPackages>>,id:string|undefined,url:string):AssetStatus{const relevant=packages.filter(item=>(id&&item.hookClipId===id)||item.videoUrl===url);for(const status of ["published","publishing","scheduled","failed"] as const)if(relevant.some(item=>item.status===status))return status;return"ready"}
export default async function Page(){
 const [sources,clips,jobs,vizardProjects,packages,libraryAssets]=await Promise.all([listVizardSources(),listHookClips(),listHookJobs(undefined,100),listVizardProjects(),listPublishPackages(),listLibraryAssets()]);
 const sourceMap=new Map(sources.map(source=>[source.slug,source]));const savedCandidateIds=new Set(clips.map(clip=>clip.candidateId).filter(Boolean));
 const assets=[
  ...libraryAssets.filter(asset=>asset.kind==="hook").map(asset=>({id:asset.id,kind:asset.source==="vizard"?"vizard" as const:"clip" as const,dramaId:asset.dramaId,dramaSlug:asset.dramaSlug,dramaTitle:asset.dramaTitle,coverUrl:asset.coverUrl,title:asset.title,sourceEpisodes:[asset.episodeNumber],videoUrl:asset.videoUrl,durationSeconds:asset.durationSeconds,generator:asset.source==="vizard"?"Vizard" as const:"Built-in" as const,status:asset.publishing.status==="never"?"ready" as const:asset.publishing.status,createdAt:asset.createdAt})),
  ...jobs.flatMap(job=>job.candidates.filter(candidate=>candidate.draftUrl&&!savedCandidateIds.has(candidate.id)).map(candidate=>{const source=sourceMap.get(job.dramaSlug);return{id:candidate.id,kind:"candidate" as const,jobId:job.id,dramaId:job.dramaId,dramaSlug:job.dramaSlug,dramaTitle:source?.title||job.dramaSlug,coverUrl:source?.coverUrl||"",title:candidate.title,sourceEpisodes:job.sourceEpisodes,videoUrl:candidate.draftUrl!,durationSeconds:candidate.durationSeconds||0,generator:"Built-in" as const,status:statusFor(packages,undefined,candidate.draftUrl!),createdAt:job.createdAt}})),
 ].filter(asset=>asset.dramaId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 const analyzed=new Map<string,Set<number>>();const mark=(dramaId:string,numbers:number[])=>{const set=analyzed.get(dramaId)||new Set<number>();numbers.forEach(number=>set.add(number));analyzed.set(dramaId,set)};for(const asset of assets)mark(asset.dramaId,asset.sourceEpisodes);for(const job of jobs)if(job.status==="review_ready")mark(job.dramaId,job.sourceEpisodes);for(const project of vizardProjects)if(project.status==="ready")mark(project.dramaId,[project.episodeNumber]);
 const dashboardSources=sources.map(source=>({...source,analyzedEpisodes:Array.from(analyzed.get(source.id)||[]).sort((a,b)=>a-b)}));
 const generationHistory=[
  ...jobs.map(job=>{const source=sourceMap.get(job.dramaSlug);return{id:job.id,method:"Built-in" as const,dramaId:job.dramaId,dramaTitle:source?.title||job.dramaSlug,coverUrl:source?.coverUrl||"",sourceEpisodes:job.sourceEpisodes,status:job.status,progress:job.progress,resultCount:job.candidates.filter(candidate=>Boolean(candidate.draftUrl)).length,createdAt:job.createdAt,errorMessage:job.errorMessage}}),
  ...vizardProjects.map(project=>{const source=sourceMap.get(project.dramaSlug);return{id:project.id,method:"Vizard" as const,dramaId:project.dramaId,dramaTitle:source?.title||project.dramaSlug,coverUrl:source?.coverUrl||"",sourceEpisodes:[project.episodeNumber],status:project.status,progress:project.status==="ready"?100:project.status==="failed"?0:10,resultCount:project.status==="ready"?1:0,createdAt:project.submittedAt}}),
 ].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
 return <AdminShell active="Hook Studio"><div className="admin-title"><div><p>Hook operations</p><h1>Hook Studio</h1></div></div><HookStudioDashboard sources={dashboardSources} assets={assets} generationHistory={generationHistory}/></AdminShell>
}
