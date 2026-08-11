"use client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, History, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { Drama } from "@/lib/types";

export function RememberDrama({ drama }: { drama: Drama }) {
  useEffect(() => { localStorage.setItem("dramaclips:last", JSON.stringify({ slug: drama.slug, at: Date.now() })); }, [drama.slug]);
  return null;
}

export function ContinueWatching({ dramas }: { dramas: Drama[] }) {
  const [drama, setDrama] = useState<Drama | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("dramaclips:last") || "null"); setDrama(dramas.find(item => item.slug === saved?.slug) || null); } catch {}
  }, [dramas]);
  if (!drama) return null;
  return <section className="resume-strip"><div className="resume-label"><History/> <span>Continue where you left off</span></div><Link href={`/watch/${drama.slug}`}><Image src={drama.coverUrl} alt="" width={52} height={70}/><div><small>Recently viewed</small><strong>{drama.title}</strong><span>Continue watching <ArrowRight/></span></div><i><Play fill="currentColor"/></i></Link></section>;
}
