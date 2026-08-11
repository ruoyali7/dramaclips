import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Drama } from "@/lib/types";
export function DramaCard({ drama, rank }: { drama: Drama; rank?: number }) { return <article className="drama-card">
  <Link href={`/watch/${drama.slug}`} className="cover-wrap" aria-label={`Watch ${drama.title}`}>
    <Image src={drama.coverUrl} alt="" fill sizes="(max-width: 640px) 46vw, 260px" className="cover"/>
    {rank && <span className="rank">0{rank}</span>}<span className="code">#{drama.publicCode}</span>
    <span className="card-arrow"><ArrowUpRight size={18}/></span>
  </Link>
  <div className="card-copy"><p>{drama.tags[0]}</p><h3><Link href={`/watch/${drama.slug}`}>{drama.title}</Link></h3><span>{drama.hook}</span></div>
  </article>; }
