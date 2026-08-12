import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Play, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { ContinueWatching } from "@/components/continue-watching";
import { getCatalog } from "@/lib/catalog";
import { trackingQuery } from "@/lib/tracking";

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams;
  const {dramas,episodes}=await getCatalog();
  const search = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const match = search ? dramas.find(drama => drama.publicCode.toLowerCase() === search || drama.promoCode?.toLowerCase() === search || drama.slug === search) : undefined;
  if (match) redirect(`/watch/${match.slug}`);
  const requested = typeof query.d === "string" ? query.d : typeof query.code === "string" ? query.code : typeof query.cl === "string" && query.cl.includes("3469908") ? "3469908" : "";
  const hero = dramas.find(d => d.slug === requested || d.publicCode === requested) || dramas[0];
  const attribution = trackingQuery(query);
  return <main className="dc-home">
    <header className="dc-nav"><Brand dark/><nav><Link href="/">Home</Link><Link href="#all-dramas">All dramas</Link><Link href="#find-by-code">Find by code</Link></nav><Link href="#find-by-code" aria-label="Find by code"><Search/></Link></header>
    <ContinueWatching dramas={dramas}/>
    <section className="dc-hero">
      <Image src={hero.coverUrl} alt="" fill priority sizes="100vw" className="dc-hero-image"/>
      <div className="dc-gradient"/>
      <div className="dc-hero-copy">
        <span className="dc-badge"><Flame fill="currentColor"/> Trending now</span>
        <p className="dc-code">Drama #{hero.publicCode}</p>
        <h1>{hero.title}</h1>
        <p className="dc-hook">{hero.hook}</p>
        <div className="dc-tags">{hero.tags.map(tag=><span key={tag}>{tag}</span>)}<span>60+ episodes</span></div>
        <Link className="dc-watch" href={`/watch/${hero.slug}?${attribution}`}><Play fill="currentColor"/> Watch free episodes <ArrowRight/></Link>
        <small>Preview free episodes here, then continue in the official app.</small>
      </div>
    </section>
    <section className="dc-find" id="find-by-code"><div><strong>Looking for the drama from your video?</strong><span>Enter the DramaClips or ReelShort promotion code</span></div><form action="/"><Search/><input name="q" inputMode="numeric" placeholder="Enter drama code" aria-label="Drama code"/><button>Find</button></form>{search&&!match&&<small>No drama found for “{search}”. Check the code and try again.</small>}</section>
    <section className="dc-trending" id="all-dramas"><div className="dc-section-head"><div><span>Browse the library</span><h2>All dramas</h2><p>Pick a story and watch the available free chapters here.</p></div><Link href="#find-by-code">Find by code <ArrowRight/></Link></div><div className="dc-poster-grid">{dramas.map((drama,index)=><Link href={`/watch/${drama.slug}`} key={drama.id} className="dc-poster"><div><Image src={drama.coverUrl} alt="" fill sizes="(max-width:700px) 42vw, 220px"/><span>{index+1}</span><i><Play fill="currentColor"/></i><b>{episodes.filter(item=>item.dramaId===drama.id).length} free chapters</b></div><small>#{drama.publicCode} · {drama.tags[0]}</small><strong>{drama.title}</strong></Link>)}</div></section>
    <section className="dc-explain"><h2>One tap back into the story.</h2><p>DramaClips matches each social video to its exact series. Use a clip link for an instant match, revisit your last drama, or search by code when needed.</p></section>
    <footer className="dc-footer"><Brand dark/><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & affiliate disclosure</Link></div><p>DramaClips may earn a commission when you continue to a third-party app.</p></footer>
  </main>;
}
