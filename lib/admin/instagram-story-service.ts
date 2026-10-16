import "server-only";
import {listVizardSources} from "./repository";
import {listPublishPackages} from "./publish-repository";
import {createInstagramStoryJobs,listInstagramStoryJobs} from "./instagram-story-repository";
import {pacificCartDates} from "@/lib/publish-cart-date";
import {addPacificDays} from "@/lib/weekly-publish-plan";
import {pacificLocalToIso} from "@/lib/publish-slots";
import {reelShortUrl} from "@/lib/instagram-story";

export const DAILY_STORY_TARGET=5;
export const DAILY_POST_STORY_TARGET=3;
export const STORY_PUBLISH_TIMES=["09:30","11:30","13:30","15:30","17:30"] as const;
const STORY_COOLDOWN_MS=7*24*60*60*1000;

export async function ensureDailyInstagramStoryPlan(now=new Date()){
  const date=pacificCartDates(now)[0];
  const existing=await listInstagramStoryJobs({scheduleDate:date,limit:DAILY_STORY_TARGET});
  if(existing.length)return existing.sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));

  const [sources,packages,history]=await Promise.all([listVizardSources(),listPublishPackages(),listInstagramStoryJobs({limit:1000})]);
  const eligible=sources.flatMap(source=>{
    const targetUrl=reelShortUrl(source.contentPromotionUrl||"");
    return source.coverUrl&&targetUrl?[{...source,targetUrl}]:[];
  });
  const bySlug=new Map(eligible.map(source=>[source.slug,source]));
  const dayStart=new Date(pacificLocalToIso(date,"00:00")).getTime();
  const dayEnd=new Date(pacificLocalToIso(addPacificDays(date,1),"00:00")).getTime();
  const dailyPostSlugs=Array.from(new Set(packages
    .filter(item=>item.scheduledAt&&new Date(item.scheduledAt).getTime()>=dayStart&&new Date(item.scheduledAt).getTime()<dayEnd&&item.platforms.some(platform=>platform.source==="instagram"))
    .sort((a,b)=>(a.scheduledAt||"").localeCompare(b.scheduledAt||""))
    .map(item=>item.dramaSlug))).filter(slug=>bySlug.has(slug)).slice(0,DAILY_POST_STORY_TARGET);

  const lastPublished=new Map<string,number>();
  for(const job of history){
    if(!job.published_at)continue;
    const published=new Date(job.published_at).getTime();
    lastPublished.set(job.drama_slug,Math.max(lastPublished.get(job.drama_slug)||0,published));
  }
  const selected=new Set(dailyPostSlugs);
  const library=eligible.filter(source=>!selected.has(source.slug)&&(now.getTime()-(lastPublished.get(source.slug)||0)>=STORY_COOLDOWN_MS))
    .sort((a,b)=>(lastPublished.get(a.slug)||0)-(lastPublished.get(b.slug)||0)||a.slug.localeCompare(b.slug));
  const chosen=[...dailyPostSlugs.map(slug=>({source:bySlug.get(slug)!,selectionSource:"daily_post" as const})),...library.slice(0,DAILY_STORY_TARGET-dailyPostSlugs.length).map(source=>({source,selectionSource:"library" as const}))];
  return createInstagramStoryJobs(chosen.map(({source,selectionSource},index)=>({
    schedule_date:date,drama_slug:source.slug,drama_title:source.title,image_url:source.coverUrl,
    content_code:source.promoCode||source.publicCode,target_url:source.targetUrl,selection_source:selectionSource,
    scheduled_at:pacificLocalToIso(date,STORY_PUBLISH_TIMES[index]),
  })));
}
