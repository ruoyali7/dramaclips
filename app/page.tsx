import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Flame, Play, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { ContinueWatching } from "@/components/continue-watching";
import { HomePageTracker } from "@/components/home-page-tracker";
import { getCatalog } from "@/lib/catalog";
import { trackingQuery } from "@/lib/tracking";

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams;
  const attribution = trackingQuery(query);
  const {dramas,episodes}=await getCatalog();
  const attributionFields = Array.from(new URLSearchParams(attribution));
  const episodeCounts = new Map<string, number>();
  episodes.forEach(episode => episodeCounts.set(episode.dramaId, (episodeCounts.get(episode.dramaId) || 0) + 1));
  const search = typeof query.q === "string" ? query.q.trim().toLowerCase() : "";
  const match = search ? dramas.find(drama => drama.publicCode.toLowerCase() === search || drama.promoCode?.toLowerCase() === search || drama.slug === search) || dramas.find(drama => drama.title.toLowerCase().includes(search) || drama.tags.some(tag => tag.toLowerCase().includes(search))) : undefined;
  if (match) redirect(`/watch/${match.slug}${attribution?`?${attribution}`:""}`);
  const requested = typeof query.d === "string" ? query.d : typeof query.code === "string" ? query.code : typeof query.cl === "string" && query.cl.includes("3469908") ? "3469908" : "";
  const hero = dramas.find(d => d.slug === requested || d.publicCode === requested) || dramas[0];
  const heroEpisodeCount = episodeCounts.get(hero.id) || 0;
  return <main className="dc-home">
    <HomePageTracker/>
    <header className="dc-nav"><Brand dark href={`/${attribution?`?${attribution}`:""}`}/><nav><Link href={`/${attribution?`?${attribution}`:""}`}>Home</Link><Link href="#all-dramas">All dramas</Link><Link href="#find-by-code">Find by code</Link></nav><Link href="#find-by-code" aria-label="Find by code"><Search/></Link></header>
    <ContinueWatching dramas={dramas} attribution={attribution}/>
    <section className="dc-hero">
      <Image src={hero.coverUrl} alt="" fill priority sizes="100vw" className="dc-hero-image"/>
      <div className="dc-gradient"/>
      <div className="dc-hero-copy">
        <span className="dc-badge"><Flame fill="currentColor"/> Newly added</span>
        <p className="dc-code">Content Code · {hero.promoCode || hero.publicCode}</p>
        <h1>{hero.title}</h1>
        <p className="dc-hook">{hero.hook}</p>
        <div className="dc-tags">{hero.tags.slice(0, 4).map(tag=><span key={tag}>{tag}</span>)}<span>{heroEpisodeCount} free {heroEpisodeCount === 1 ? "chapter" : "chapters"}</span></div>
        <Link className="dc-watch" href={`/watch/${hero.slug}${attribution?`?${attribution}`:""}`}><Play fill="currentColor"/> Watch free episodes <ArrowRight/></Link>
        <small>Preview free episodes here, then continue in the official app.</small>
      </div>
    </section>
    <section className="dc-find" id="find-by-code"><div><strong>Find your drama</strong><span>Search by title or Dramora AI / ReelShort promotion code</span></div><form action="/"><Search/>{attributionFields.map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}<input name="q" enterKeyHint="search" placeholder="Enter title or code" aria-label="Drama title or code"/><button>Find</button></form>{search&&!match&&<small>No drama found for “{search}”. Check the title or code and try again.</small>}</section>
    <section className="dc-trending" id="all-dramas"><div className="dc-section-head"><div><span>Browse the library</span><h2>All dramas</h2><p>Pick a story and watch the available free chapters here.</p></div><Link href="#find-by-code">Find by code <ArrowRight/></Link></div><div className="dc-poster-grid">{dramas.map((drama)=>{const count=episodeCounts.get(drama.id)||0;return <Link href={`/watch/${drama.slug}${attribution?`?${attribution}`:""}`} key={drama.id} className="dc-poster"><div><Image src={drama.coverUrl} alt="" fill sizes="(max-width:700px) 42vw, 220px"/><i><Play fill="currentColor"/></i><b>{count} free {count===1?"chapter":"chapters"}</b></div><small>Content Code · {drama.promoCode || drama.publicCode}{drama.tags[0]?` · ${drama.tags[0]}`:""}</small><strong>{drama.title}</strong></Link>})}</div></section>
    <section className="dc-explain"><h2>One tap back into the story.</h2><p>Dramora AI matches each social video to its exact series. Use a clip link for an instant match, revisit your last drama, or search by code when needed.</p></section>
    <footer className="dc-footer"><Brand dark href={`/${attribution?`?${attribution}`:""}`}/><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & affiliate disclosure</Link></div><p>Dramora AI may earn a commission when you continue to a third-party app.</p></footer>
  </main>;
}
