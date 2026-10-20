"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { CatalogPosterCard } from "@/components/catalog-poster-card";
import { nextCatalogCount } from "@/lib/catalog-browse";
import type { PublicDrama } from "@/lib/types";

const pageSize = 24;

export function BrowseGrid({ items, attribution = "" }: { items: Array<{ drama: PublicDrama; episodeCount: number }>; attribution?: string }) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const visible = items.slice(0, visibleCount);

  return <>
    <div className="browse-grid">{visible.map(({ drama, episodeCount }) => <CatalogPosterCard key={drama.id} drama={drama} episodeCount={episodeCount} attribution={attribution}/>)}</div>
    {visibleCount < items.length && <button className="browse-more" type="button" onClick={() => setVisibleCount(current => nextCatalogCount(current, items.length, pageSize))}>Load more dramas <ArrowRight/></button>}
  </>;
}
