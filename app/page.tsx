import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Play, Search } from "lucide-react";
import { Brand } from "@/components/brand";
import { CatalogPosterCard } from "@/components/catalog-poster-card";
import { ContinueWatching } from "@/components/continue-watching";
import { HomePageTracker } from "@/components/home-page-tracker";
import { SearchBox } from "@/components/search-box";
import { getCatalog } from "@/lib/catalog";
import { catalogGenres } from "@/lib/catalog-browse";
import { toPublicDrama } from "@/lib/catalog-presentation";
import { findExactDrama, rankDramaMatches, requestedDramaIdentifier } from "@/lib/catalog-routing";
import { trackingQuery } from "@/lib/tracking";

export default async function Home({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const query = await searchParams;
  const attribution = trackingQuery(query);
  const {dramas,episodes}=await getCatalog();
  const episodeCounts = new Map<string, number>();
  episodes.forEach(episode => episodeCounts.set(episode.dramaId, (episodeCounts.get(episode.dramaId) || 0) + 1));
  const search = typeof query.q === "string" ? query.q.trim() : "";
  const match = rankDramaMatches(dramas, search, 1)[0];
  if (match) redirect(`/watch/${match.slug}${attribution?`?${attribution}`:""}`);
  const requested = requestedDramaIdentifier(query);
  const requestedDrama = findExactDrama(dramas, requested);
  if (requestedDrama) redirect(`/watch/${requestedDrama.slug}${attribution?`?${attribution}`:""}`);
  const hero = dramas[0];
  const heroEpisodeCount = episodeCounts.get(hero.id) || 0;
  const publicDramas = dramas.map(toPublicDrama);
  const featuredDramas = publicDramas.slice(0, 6);
  const genres = catalogGenres(dramas).slice(0, 8);
  return <main className="dc-home">
    <HomePageTracker/>
    <header className="dc-nav"><Brand dark href={`/${attribution?`?${attribution}`:""}`}/><nav><Link href={`/${attribution?`?${attribution}`:""}`}>Home</Link><Link href={`/browse${attribution?`?${attribution}`:""}`}>Browse</Link><Link href="#find-by-code">Find by code</Link></nav><Link href="#find-by-code" aria-label="Find by code"><Search/></Link></header>
    <ContinueWatching dramas={publicDramas} attribution={attribution}/>
    <section className="dc-hero">
      <Image src={hero.coverUrl} alt="" fill priority sizes="100vw" className="dc-hero-image"/>
      <div className="dc-gradient"/>
      <div className="dc-hero-copy">
        <span className="dc-badge"><Play fill="currentColor"/> Featured preview</span>
        <p className="dc-code">Content Code · {hero.promoCode || hero.publicCode}</p>
        <h1>{hero.title}</h1>
        <p className="dc-hook">{hero.hook}</p>
        <div className="dc-tags">{hero.tags.slice(0, 4).map(tag=><span key={tag}>{tag}</span>)}<span>{heroEpisodeCount} free {heroEpisodeCount === 1 ? "chapter" : "chapters"}</span></div>
        <Link className="dc-watch" href={`/watch/${hero.slug}${attribution?`?${attribution}`:""}`}><Play fill="currentColor"/> Watch free episodes <ArrowRight/></Link>
        <small>Preview free episodes here, then continue in the official app.</small>
      </div>
    </section>
    {requested&&!requestedDrama&&<aside className="dc-request-error" role="status"><strong>We couldn’t match that drama.</strong><span>Search by title or code, or browse the catalog below.</span></aside>}
    <section className="dc-find" id="find-by-code"><div><strong>Find your drama</strong><span>Search by title or Dramora AI / ReelShort promotion code</span></div><SearchBox dramas={publicDramas} attribution={attribution} initialQuery={search||(requested&&!requestedDrama?requested:"")}/>{search&&!match&&<small>No drama found for “{search}”. Check the title or code and try again.</small>}</section>
    <section className="dc-library-preview" id="all-dramas">
      <div className="dc-section-head"><div><span>Start your next obsession</span><h2>Featured dramas</h2><p>A focused selection from the library—without an endless homepage.</p></div><Link href={`/browse${attribution?`?${attribution}`:""}`}>Browse all {dramas.length} <ArrowRight/></Link></div>
      <div className="dc-poster-rail">{featuredDramas.map(drama => <CatalogPosterCard key={drama.id} drama={drama} episodeCount={episodeCounts.get(drama.id) || 0} attribution={attribution}/>)}</div>
      {genres.length > 0 && <div className="dc-genre-band"><div><span>Browse by genre</span><strong>Pick a mood</strong></div><nav aria-label="Browse dramas by genre">{genres.map(genre => <Link key={genre} href={`/browse?genre=${encodeURIComponent(genre)}${attribution?`&${attribution}`:""}`}>{genre}<ArrowRight/></Link>)}</nav></div>}
    </section>
    <section className="dc-explain"><h2>One tap back into the story.</h2><p>Dramora AI matches each social video to its exact series. Use a clip link for an instant match, revisit your last drama, or search by code when needed.</p></section>
    <footer className="dc-footer"><Brand dark href={`/${attribution?`?${attribution}`:""}`}/><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & affiliate disclosure</Link></div><p>Dramora AI may earn a commission when you continue to a third-party app.</p></footer>
  </main>;
}
