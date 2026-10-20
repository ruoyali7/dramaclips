import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, SlidersHorizontal, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { CatalogPosterCard } from "@/components/catalog-poster-card";
import { browseCatalog, catalogGenres, type CatalogSort } from "@/lib/catalog-browse";
import { getCatalog } from "@/lib/catalog";
import { toPublicDrama } from "@/lib/catalog-presentation";
import { trackingQuery } from "@/lib/tracking";

export const metadata: Metadata = {
  title: "Browse dramas | Dramora AI",
  description: "Search and filter the Dramora AI short-drama library."
};

type SearchParams = Record<string, string | string[] | undefined>;

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function browseUrl(values: Record<string, string | number | undefined>, attribution: string) {
  const params = new URLSearchParams(attribution);
  Object.entries(values).forEach(([name, value]) => {
    if (value && value !== "featured" && value !== 1) params.set(name, String(value));
  });
  const query = params.toString();
  return `/browse${query ? `?${query}` : ""}`;
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const attribution = trackingQuery(params);
  const query = stringParam(params.q);
  const genre = stringParam(params.genre);
  const requestedSort = stringParam(params.sort);
  const sort: CatalogSort = requestedSort === "newest" || requestedSort === "title" ? requestedSort : "featured";
  const requestedPage = Number.parseInt(stringParam(params.page), 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const { dramas, episodes } = await getCatalog();
  const episodeCounts = new Map<string, number>();
  episodes.forEach(episode => episodeCounts.set(episode.dramaId, (episodeCounts.get(episode.dramaId) || 0) + 1));
  const genres = catalogGenres(dramas);
  const results = browseCatalog(dramas, query, genre, sort);
  const visible = results.slice(0, page * 24).map(toPublicDrama);
  const hasMore = visible.length < results.length;
  const attributionFields = Array.from(new URLSearchParams(attribution));

  return <main className="browse-page">
    <header className="dc-nav"><Brand dark href={`/${attribution ? `?${attribution}` : ""}`}/><nav><Link href={`/${attribution ? `?${attribution}` : ""}`}>Home</Link><Link href={`/browse${attribution ? `?${attribution}` : ""}`} aria-current="page">Browse</Link><Link href="/#find-by-code">Find by code</Link></nav><Link href="#catalog-filters" aria-label="Search the library"><Search/></Link></header>

    <section className="browse-hero">
      <span>Drama library</span>
      <h1>Find your next<br/><em>obsession.</em></h1>
      <p>Search by title or code, narrow the mood, and keep the homepage focused on discovery.</p>
    </section>

    <section className="browse-shell" id="catalog-filters">
      <form className="browse-controls" action="/browse">
        {attributionFields.map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
        <label className="browse-search"><Search/><span className="sr-only">Search dramas</span><input name="q" defaultValue={query} placeholder="Search title, genre, or content code…"/></label>
        <label className="browse-sort"><SlidersHorizontal/><span className="sr-only">Sort dramas</span><select name="sort" defaultValue={sort}><option value="featured">Featured</option><option value="newest">Newest</option><option value="title">Title A–Z</option></select></label>
        {genre && <input type="hidden" name="genre" value={genre}/>}<button type="submit">Apply</button>
      </form>

      <nav className="genre-chips" aria-label="Filter by genre">
        <Link className={!genre ? "active" : ""} href={browseUrl({ q: query, sort }, attribution)}>All</Link>
        {genres.map(item => <Link className={item.toLowerCase() === genre.toLowerCase() ? "active" : ""} key={item} href={browseUrl({ q: query, genre: item, sort }, attribution)}>{item}</Link>)}
      </nav>

      <div className="browse-result-head"><div><span>{results.length} {results.length === 1 ? "drama" : "dramas"}</span><h2>{genre || (query ? `Results for “${query}”` : "All dramas")}</h2></div>{(query || genre) && <Link href={browseUrl({ sort }, attribution)}>Clear filters <X/></Link>}</div>

      {visible.length > 0 ? <div className="browse-grid">{visible.map(drama => <CatalogPosterCard key={drama.id} drama={drama} episodeCount={episodeCounts.get(drama.id) || 0} attribution={attribution}/>)}</div> : <div className="browse-empty"><Search/><h2>No dramas found</h2><p>Try a different title, code, or genre.</p><Link href={browseUrl({}, attribution)}>See the full library <ArrowRight/></Link></div>}

      {hasMore && <Link className="browse-more" href={browseUrl({ q: query, genre, sort, page: page + 1 }, attribution)}>Load more dramas <ArrowRight/></Link>}
    </section>

    <footer className="dc-footer"><Brand dark href={`/${attribution ? `?${attribution}` : ""}`}/><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & affiliate disclosure</Link></div><p>Dramora AI may earn a commission when you continue to a third-party app.</p></footer>
  </main>;
}
