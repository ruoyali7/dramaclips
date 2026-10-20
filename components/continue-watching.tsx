"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, History, Play } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicDrama } from "@/lib/types";
import { readWatchHistory, saveWatchProgress, type WatchHistoryEntry } from "@/lib/watch-history";

export function RememberDrama({ drama }: { drama: PublicDrama }) {
  useEffect(() => {
    const previous = readWatchHistory(localStorage).find(item => item.slug === drama.slug);
    saveWatchProgress(localStorage, { ...previous, slug: drama.slug, at: Date.now() });
  }, [drama.slug]);
  return null;
}

export function ContinueWatching({ dramas, attribution = "" }: { dramas: PublicDrama[]; attribution?: string }) {
  const [history, setHistory] = useState<WatchHistoryEntry[]>([]);
  useEffect(() => { setHistory(readWatchHistory(localStorage)); }, []);
  const items = history.flatMap(entry => {
    const drama = dramas.find(item => item.slug === entry.slug);
    return drama ? [{ drama, entry }] : [];
  }).slice(0, 3);
  if (!items.length) return null;
  return <section className="resume-strip">
    <div className="resume-label"><History/> <span>Continue where you left off</span></div>
    <div className="resume-items">{items.map(({ drama, entry }) => <Link href={`/watch/${drama.slug}${attribution?`?${attribution}`:""}`} key={drama.id}>
      <Image src={drama.coverUrl} alt="" width={52} height={70}/><div><small>{entry.episode?`Resume episode ${entry.episode}`:"Recently viewed"}</small><strong>{drama.title}</strong><span>Continue watching <ArrowRight/></span></div><i><Play fill="currentColor"/></i>
    </Link>)}</div>
  </section>;
}
