import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Bookmark, Copy } from "lucide-react";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { DramaCard } from "@/components/drama-card";
import { TrackLink } from "@/components/track-link";
import { RememberDrama } from "@/components/continue-watching";
import { getCatalog, getDramaBySlug } from "@/lib/catalog";
import { trackingQuery } from "@/lib/tracking";

export const dynamic="force-dynamic";
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata> { const {slug}=await params; const d=await getDramaBySlug(slug); return d ? {title:d.title,description:d.hook,alternates:{canonical:`/d/${d.slug}`},openGraph:{images:[d.coverUrl]}} : {}; }
export default async function DramaDetail({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}) { const {slug}=await params; const resolvedSearch=await searchParams; const [d,catalog]=await Promise.all([getDramaBySlug(slug),getCatalog()]); if(!d||d.status!=="published") notFound(); const query=trackingQuery(resolvedSearch); return <main className="detail-page"><RememberDrama drama={d}/><header className="detail-nav"><Link href="/"><ArrowLeft/></Link><Brand/><button aria-label="Save"><Bookmark/></button></header>
  <section className="detail-hero"><div className="detail-cover" style={{"--accent":d.accent} as React.CSSProperties}><Image src={d.coverUrl} alt={`${d.title} cover`} fill priority sizes="(max-width: 700px) 82vw, 390px"/></div><div className="detail-copy"><span className="kicker">Drama #{d.publicCode}</span><h1>{d.title}</h1><div className="tag-row dark">{d.tags.map(t=><span key={t}>{t}</span>)}</div><blockquote>“{d.hook}”</blockquote><p>{d.description}</p><TrackLink href={`/watch/${d.slug}?${query}`} label="Watch free episodes"/><small>Preview here, then continue in the official app.</small>{d.promoCode && <div className="promo"><div><span>Search code after install</span><strong>{d.promoCode}</strong></div><button title="Copy code" data-code={d.promoCode}><Copy/></button></div>}</div></section>
  <section className="related"><span className="kicker">You may also like</span><div className="card-grid">{catalog.dramas.filter(x=>x.id!==d.id).slice(0,3).map(x=><DramaCard key={x.id} drama={x}/>)}</div></section></main>; }
