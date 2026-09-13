import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAnalyticsRange, type AnalyticsBreakdown, type AnalyticsRangeSummary } from "@/lib/admin/analytics-repository";
import { analyticsPeriods } from "@/lib/analytics-periods";
import "./analytics.css";

export const dynamic = "force-dynamic";
const timeZone = process.env.ANALYTICS_TIME_ZONE || "America/Los_Angeles";
const number = (value:number) => value.toLocaleString();
function delta(current:number,previous:number){
  if(!previous)return current?"New activity":"No change";
  const value=Math.round((current-previous)/previous*100);
  return `${value>=0?"+":""}${value}%`;
}
function Metric({label,value,today,help,primary=false}:{label:string;value:number;today:number;help:string;primary?:boolean}){
  return <article className={primary?"analytics-metric primary":"analytics-metric"}><span>{label}</span><strong>{number(value)}</strong><small>今日新增 {number(today)} · {help}</small></article>;
}
function Breakdown({title,rows}:{title:string;rows:AnalyticsBreakdown[]}){
  return <section className="panel analytics-breakdown"><span>Conversion breakdown</span><h2>{title}</h2><div className="analytics-breakdown-head"><b>Name</b><b>Sessions</b><b>Code copies</b><b>RS redirects</b></div>{rows.length?rows.slice(0,12).map(([name,sessions,copies,redirects])=><div key={name}><b>{name}</b><span>{number(sessions)}</span><span>{number(copies)}</span><span>{number(redirects)}</span></div>):<p>No tracked activity in this period.</p>}</section>;
}
function Comparison({current,previous,days}:{current:AnalyticsRangeSummary;previous:AnalyticsRangeSummary;days:number}){
 const rows:[string,keyof AnalyticsRangeSummary][]=[["Code copies","promoCodeCopies"],["RS redirects","rsRedirects"],["Unique sessions","sessions"],["Preview starts","previewStarts"]];
 return <section className="panel analytics-comparison"><span>Comparable windows</span><h2>Current {days} days vs previous {days}</h2>{rows.map(([label,key])=><div key={key}><b>{label}</b><span><strong>{number(current[key] as number)}</strong><small>{delta(current[key] as number,previous[key] as number)}</small></span></div>)}</section>;
}

export default async function Page({searchParams}:{searchParams:Promise<{days?:string}>}) {
 const query=await searchParams;const days=[7,30,90].includes(Number(query.days))?Number(query.days):30;
 const periods=analyticsPeriods(days,new Date(),timeZone);
 let current:AnalyticsRangeSummary|null=null,today:AnalyticsRangeSummary|null=null,previous:AnalyticsRangeSummary|null=null,yesterday:AnalyticsRangeSummary|null=null,error="";
 try{[current,today,previous,yesterday]=await Promise.all([getAnalyticsRange(periods.range.from,periods.range.to,timeZone),getAnalyticsRange(periods.today.from,periods.today.to,timeZone),getAnalyticsRange(periods.previous.from,periods.previous.to,timeZone),getAnalyticsRange(periods.yesterday.from,periods.yesterday.to,timeZone)]);}
 catch(reason){error=reason instanceof Error?reason.message:"Analytics unavailable";}
 return <AdminShell active="Analytics">
  <div className="admin-title"><div><p>Conversion analytics · {timeZone}</p><h1>Analytics</h1></div><nav className="analytics-range" aria-label="Analytics date range">{[7,30,90].map(value=><Link className={days===value?"selected":""} href={`/admin/analytics?days=${value}`} key={value}>{value} days</Link>)}<Link href={`/admin/analytics?days=${days}`}>Refresh</Link></nav></div>
  {current&&today&&previous&&yesterday?<>
   <section className="analytics-definition"><b>What matters most</b><span>Code copies and outbound RS clicks are first-party intent signals. They are not confirmed searches, installs, orders, or revenue.</span></section>
   <div className="analytics-primary">
    <Metric primary label="Code copies" value={current.promoCodeCopies} today={today.promoCodeCopies} help={`${number(current.manualCodeCopies)} manual · ${number(current.automaticCodeCopies)} automatic · ${number(current.unclassifiedCodeCopies)} older/unclassified`}/>
    <Metric primary label="RS redirects" value={current.rsRedirects} today={today.rsRedirects} help="outbound clicks initiated"/>
    <Metric primary label="Unique sessions" value={current.sessions} today={today.sessions} help="30-day browser cookie estimate"/>
   </div>
   <div className="analytics-secondary">
    <Metric label="Page views" value={current.pageViews} today={today.pageViews} help={`Bio ${number(current.bioPageViews)} · Clip ${number(current.clipPageViews)}`}/>
    <Metric label="Short-link clicks" value={current.shortLinkClicks} today={today.shortLinkClicks} help="kept separate from page views"/>
    <Metric label="Preview starts" value={current.previewStarts} today={today.previewStarts} help="first play per episode per page load"/>
    <Metric label="Preview completions" value={current.previewCompletions} today={today.previewCompletions} help="first completion per episode"/>
   </div>
   <div className="analytics-grid">
    <Comparison current={current} previous={previous} days={days}/>
    <section className="panel analytics-comparison"><span>Same elapsed time</span><h2>Today vs yesterday</h2>{([["Code copies","promoCodeCopies"],["RS redirects","rsRedirects"],["Unique sessions","sessions"]] as [string,keyof AnalyticsRangeSummary][]).map(([label,key])=><div key={key}><b>{label}</b><span><strong>{number(today[key] as number)}</strong><small>{delta(today[key] as number,yesterday[key] as number)}</small></span></div>)}</section>
   </div>
   <div className="analytics-grid"><Breakdown title="By drama" rows={current.byDrama}/><Breakdown title="By source" rows={current.bySource}/></div>
   <section className="panel analytics-daily"><span>Daily intent</span><h2>Code copies and RS redirects</h2><div className="analytics-daily-head"><b>Date</b><b>Sessions</b><b>Copies</b><b>Redirects</b></div>{current.daily.map(([day,sessions,copies,redirects])=><div key={day}><time>{day}</time><span>{number(sessions)}</span><span>{number(copies)}</span><span>{number(redirects)}</span></div>)}</section>
   <section className="panel analytics-note"><b>Attribution limits</b><p>Facebook posts that link directly to ReelShort bypass DramaClips tracking. “Redirect success” only confirms that our redirect route responded; it is shown separately from RS outbound clicks and does not prove a conversion.</p><small>{number(current.redirectSuccesses)} server redirect responses in this period · {number(current.events)} total tracked events</small></section>
  </>:<section className="panel analytics-error"><span>Analytics unavailable</span><h2>Could not load the dashboard</h2><p>{/analytics_summary_v2|PGRST202|404/.test(error)?"Apply the latest Supabase Analytics migration, then retry.":"The Analytics service returned a temporary error. Your tracking data was not deleted."}</p><Link href={`/admin/analytics?days=${days}`}>Retry</Link><details><summary>Technical detail</summary><code>{error}</code></details></section>}
 </AdminShell>;
}
