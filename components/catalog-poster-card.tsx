import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { PublicDrama } from "@/lib/types";

export function CatalogPosterCard({ drama, episodeCount, attribution = "" }: { drama: PublicDrama; episodeCount: number; attribution?: string }) {
  return <Link href={`/watch/${drama.slug}${attribution ? `?${attribution}` : ""}`} className="dc-poster">
    <div>
      <Image src={drama.coverUrl} alt="" fill sizes="(max-width:700px) 42vw, 220px"/>
      <i><Play fill="currentColor"/></i>
      <b>{episodeCount} free {episodeCount === 1 ? "chapter" : "chapters"}</b>
    </div>
    <small>Content Code · {drama.promoCode || drama.publicCode}{drama.tags[0] ? ` · ${drama.tags[0]}` : ""}</small>
    <strong>{drama.title}</strong>
  </Link>;
}
