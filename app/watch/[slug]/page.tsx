import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Play, Search } from "lucide-react";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { EpisodePlayer } from "@/components/watch/episode-player";
import { DramaCard } from "@/components/drama-card";
import { dramas, getEpisodes } from "@/lib/demo-data";
import { trackingQuery } from "@/lib/tracking";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const drama=dramas.find(d=>d.slug===slug);return drama?{title:`Watch ${drama.title}`,description:drama.hook,robots:{index:true,follow:true}}:{}}
export default async function WatchPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){const {slug}=await params;const query=await searchParams;const drama=dramas.find(d=>d.slug===slug&&d.status==="published");if(!drama)notFound();const list=getEpisodes(drama.id);return <main className="watch-page"><header className="watch-nav"><Link href="/"><ArrowLeft/></Link><Brand dark/><Link href="/search"><Search/></Link></header><EpisodePlayer drama={drama} episodes={list} goHref={`/go/${drama.routeSlug}?${trackingQuery(query)}`}/><section className="watch-more"><div><span>Up next</span><h2>More stories to binge</h2></div><div className="card-grid">{dramas.filter(d=>d.id!==drama.id).slice(0,3).map(d=><DramaCard drama={d} key={d.id}/>)}</div></section><div className="mobile-watch-bar"><Link href={`/go/${drama.routeSlug}?${trackingQuery(query)}`}><Play fill="currentColor"/> Watch full series</Link></div></main>}
