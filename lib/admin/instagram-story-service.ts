import "server-only";
import {listVizardSources} from "./repository";
import {listPublishPackages} from "./publish-repository";
import {createInstagramStoryJobs,listInstagramStoryJobs,updateInstagramStoryJobSchedule} from "./instagram-story-repository";
import {pacificCartDates} from "@/lib/publish-cart-date";
import {addPacificDays} from "@/lib/weekly-publish-plan";
import {pacificLocalToIso} from "@/lib/publish-slots";
import {reelShortUrl} from "@/lib/instagram-story";

export const DAILY_STORY_TARGET=5;
export const STORY_FIRST_DELAY_MS=10*60*1000;
export const STORY_INTERVAL_MS=2*60*60*1000;
const STORY_COOLDOWN_MS=7*24*60*60*1000;

export async function createReconnectInstagramStoryPlan(now=new Date()){
  const date=pacificCartDates(now)[0];
  const existing=await listInstagramStoryJobs({scheduleDate:date,limit:100});
  const scheduled=existing.filter(job=>job.status==="scheduled").sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
  const fixed=existing.filter(job=>job.status!=="scheduled");
  const remaining=Math.max(0,DAILY_STORY_TARGET-fixed.length);
  const reconnectedAt=now.toISOString();
  const slots=Array.from({length:remaining},(_,index)=>new Date(now.getTime()+STORY_FIRST_DELAY_MS+index*STORY_INTERVAL_MS).toISOString());
  await Promise.all(scheduled.slice(0,remaining).map((job,index)=>updateInstagramStoryJobSchedule(job.id,slots[index],reconnectedAt)));
  if(fixed.length+scheduled.length>=DAILY_STORY_TARGET){
    return (await listInstagramStoryJobs({scheduleDate:date,limit:100})).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
  }

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
    .map(item=>item.dramaSlug))).filter(slug=>bySlug.has(slug));

  const lastPublished=new Map<string,number>();
  for(const job of history){
    if(!job.published_at)continue;
    const published=new Date(job.published_at).getTime();
    lastPublished.set(job.drama_slug,Math.max(lastPublished.get(job.drama_slug)||0,published));
  }
  const eligibleDailyPostSlugs=dailyPostSlugs
    .filter(slug=>now.getTime()-(lastPublished.get(slug)||0)>=STORY_COOLDOWN_MS)
    .slice(0,DAILY_STORY_TARGET);
  const selected=new Set(existing.map(job=>job.drama_slug));
  const availableDailyPostSlugs=eligibleDailyPostSlugs.filter(slug=>!selected.has(slug));
  availableDailyPostSlugs.forEach(slug=>selected.add(slug));
  const library=eligible.filter(source=>!selected.has(source.slug)&&(now.getTime()-(lastPublished.get(source.slug)||0)>=STORY_COOLDOWN_MS))
    .sort((a,b)=>(lastPublished.get(a.slug)||0)-(lastPublished.get(b.slug)||0)||a.slug.localeCompare(b.slug));
  const needed=DAILY_STORY_TARGET-existing.length;
  const chosen=[...availableDailyPostSlugs.map(slug=>({source:bySlug.get(slug)!,selectionSource:"daily_post" as const})),...library.map(source=>({source,selectionSource:"library" as const}))].slice(0,needed);
  await createInstagramStoryJobs(chosen.map(({source,selectionSource},index)=>({
    schedule_date:date,drama_slug:source.slug,drama_title:source.title,image_url:source.coverUrl,
    content_code:source.promoCode||source.publicCode,target_url:source.targetUrl,selection_source:selectionSource,
    scheduled_at:slots[scheduled.length+index],reconnected_at:reconnectedAt,
  })));
  return (await listInstagramStoryJobs({scheduleDate:date,limit:100})).sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at));
}

export async function listDueInstagramStoryJobs(now=new Date()){
  return listInstagramStoryJobs({status:"scheduled",dueBefore:now.toISOString(),requireReconnect:true,limit:DAILY_STORY_TARGET});
}
