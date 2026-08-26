import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { DramaCard } from "@/components/drama-card";
import { Brand } from "@/components/brand";
import { TrackLink } from "@/components/track-link";
import { RememberDrama } from "@/components/continue-watching";
import { defaultLanding, dramas } from "@/lib/demo-data";
import { trackingQuery } from "@/lib/tracking";

export default async function Landing({ params, searchParams }: { params:Promise<{slug:string}>; searchParams:Promise<Record<string,string|string[]|undefined>> }) { const resolvedParams=await params; const resolvedSearch=await searchParams; if (resolvedParams.slug !== defaultLanding.slug && resolvedParams.slug !== "account-us-01" && resolvedParams.slug !== "secret-billionaire") notFound(); const hero=dramas[0]; const query=trackingQuery(resolvedSearch); return <main className="landing-page"><RememberDrama drama={hero}/>
  <div className="landing-hero"><Image src={hero.coverUrl} alt="" fill priority sizes="100vw" className="landing-bg"/><div className="landing-shade"/><header className="landing-nav"><Link href="/"><ArrowLeft/></Link><Brand dark/><span/></header>
  <div className="landing-content"><span className="pill">Featured story · Content Code {hero.promoCode || hero.publicCode}</span><h1>{hero.title}</h1><p>{hero.hook}</p><div className="tag-row">{hero.tags.map(t=><span key={t}>{t}</span>)}</div><TrackLink href={`/watch/${hero.slug}?${query}`} label="Watch free episodes"/><small>Preview here, then continue in the official app.</small></div><ChevronDown className="landing-down"/></div>
  <section className="landing-more"><span className="kicker">More stories for you</span><h2>Can't stop now.</h2><div className="card-grid">{dramas.slice(1).map((d,i)=><DramaCard key={d.id} drama={d} rank={i+2}/>)}</div></section>
  </main>; }
