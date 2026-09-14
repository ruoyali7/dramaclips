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

export function ContinueWatching({ dramas, attribution = "" }: { dramas: Drama[]; attribution?: string }) {
  const [drama, setDrama] = useState<Drama | null>(null);
  const [episode, setEpisode] = useState<number | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("dramaclips:last") || "null"); setDrama(dramas.find(item => item.slug === saved?.slug) || null); setEpisode(typeof saved?.episode === "number" ? saved.episode : null); } catch {}
  }, [dramas]);
  if (!drama) return null;
  return <section className="resume-strip"><div className="resume-label"><History/> <span>Continue where you left off</span></div><Link href={`/watch/${drama.slug}${attribution?`?${attribution}`:""}`}><Image src={drama.coverUrl} alt="" width={52} height={70}/><div><small>{episode?`Resume episode ${episode}`:"Recently viewed"}</small><strong>{drama.title}</strong><span>Continue watching <ArrowRight/></span></div><i><Play fill="currentColor"/></i></Link></section>;
}
