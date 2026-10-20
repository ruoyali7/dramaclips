import Image from "next/image";
import { ExternalLink, Play } from "lucide-react";
import type { PublicDrama } from "@/lib/types";
import { AffiliateCta } from "./affiliate-cta";

export function EmptyEpisodeState({ drama, goHref }: { drama: PublicDrama; goHref: string }) {
  return <section className="empty-preview">
    <div className="empty-preview-cover"><Image src={drama.coverUrl} alt={`${drama.title} cover`} fill priority sizes="(max-width: 760px) 70vw, 360px"/></div>
    <div className="empty-preview-copy">
      <span className="watch-kicker">#{drama.publicCode}</span>
      <h1>{drama.title}</h1>
      <p>Preview episodes are not available here yet. You can continue to the official app for this drama.</p>
      <AffiliateCta className="watch-full" href={goHref} code={drama.promoCode} dramaId={drama.id} dramaSlug={drama.slug} position="empty_preview">
        <Play fill="currentColor"/> Continue Watching on ReelShort <ExternalLink/>
      </AffiliateCta>
      {drama.promoCode&&<div className="empty-preview-code"><span>ReelShort search code</span><strong>{drama.promoCode}</strong></div>}
    </div>
  </section>;
}
