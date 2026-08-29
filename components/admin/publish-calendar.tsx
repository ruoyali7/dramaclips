"use client";

import { ChevronLeft, ChevronRight, ExternalLink, Play } from "lucide-react";
import { useMemo, useState } from "react";

type Package = {
  id: string;
  dramaSlug: string;
  episodeNumber: number;
  videoUrl: string;
  videoKind: string;
  videoLabel?: string;
  scheduledAt?: string;
  status: string;
  platforms: { source: string }[];
  createdAt: string;
  yixiaoerUpdatedAt?: string;
  yixiaoerResults?: Record<string, unknown>;
};

type Source = { slug: string; title: string };

const platformNames: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
};

function isDraft(item: Package) {
  const intent = item.yixiaoerResults?._intent;
  return Boolean(item.yixiaoerResults?._draft) ||
    (intent && typeof intent === "object" && (intent as Record<string, unknown>).deliveryMode === "draft");
}

function eventDate(item: Package) {
  return new Date(item.scheduledAt || item.yixiaoerUpdatedAt || item.createdAt);
}

function statusLabel(item: Package) {
  if (isDraft(item)) return "Draft";
  if (item.status === "scheduled") return "Scheduled";
  if (item.status === "published") return "Published";
  if (item.status === "failed" || item.status === "outcome_unknown") return "Attention";
  return item.status.replaceAll("_", " ");
}

export function PublishCalendar({ packages, sources }: { packages: Package[]; sources: Source[] }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState<"days" | "week" | "month">("days");
  const [selected, setSelected] = useState<Package | null>(null);
  const sourceName = (slug: string) => sources.find((source) => source.slug === slug)?.title || slug;
  const cells = useMemo(() => {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const start = new Date(view === "month" ? first : anchor);
    if (view === "week") start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: view === "days" ? 4 : view === "week" ? 7 : 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [anchor, view]);
  const byDay = useMemo(() => {
    const map = new Map<string, Package[]>();
    packages.forEach((item) => {
      const date = eventDate(item);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      map.set(key, [...(map.get(key) || []), item]);
    });
    map.forEach((items, key) => map.set(key, items.sort((left, right) => eventDate(left).getTime() - eventDate(right).getTime())));
    return map;
  }, [packages]);

  return (
    <section className="publish-calendar">
      <div className="publish-calendar-head">
        <div><span>Calendar</span><h2>{view === "days" ? `${cells[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${cells[cells.length - 1]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : view === "week" ? `Week of ${cells[0]?.toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2></div>
        <div className="publish-calendar-actions">
          <button onClick={() => setAnchor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - (view === "days" ? 4 : view === "week" ? 7 : 1)))} aria-label="Previous period"><ChevronLeft /></button>
          <button onClick={() => setAnchor(new Date())}>Today</button>
          <button onClick={() => setAnchor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + (view === "days" ? 4 : view === "week" ? 7 : 1)))} aria-label="Next period"><ChevronRight /></button>
          <button className={view === "days" ? "selected" : ""} onClick={() => setView("days")}>4 days</button>
          <button className={view === "week" ? "selected" : ""} onClick={() => setView("week")}>Week</button>
          <button className={view === "month" ? "selected" : ""} onClick={() => setView("month")}>Month</button>
        </div>
      </div>
      <div className={`publish-calendar-weekdays ${view === "days" ? "four-day" : ""}`}>{(view === "days" ? cells : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]).map((day, index) => <b key={typeof day === "string" ? day : index}>{typeof day === "string" ? day : day.toLocaleDateString(undefined, { weekday: "short" })}</b>)}</div>
      <div className={`publish-calendar-grid ${view === "days" ? "four-day" : ""}`}>
        {cells.map((date) => {
          const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
          const items = byDay.get(key) || [];
          return <div className={`publish-calendar-day${view === "month" && date.getMonth() !== anchor.getMonth() ? " muted" : ""}`} key={key}>
            <time>{date.getDate()}</time>
            {items.map((item) => <button className={`publish-calendar-event ${statusLabel(item).toLowerCase()}`} key={item.id} onClick={() => setSelected(item)}>
              <strong>{eventDate(item).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</strong>
              <span>{sourceName(item.dramaSlug)} · EP {item.episodeNumber}</span>
              <small>{item.platforms.map((platform) => platformNames[platform.source] || platform.source).join(" · ")}</small>
            </button>)}
          </div>;
        })}
      </div>
      {selected && <div className="publish-calendar-detail">
        <div className="publish-calendar-detail-head"><div><span>{statusLabel(selected)}</span><h3>{sourceName(selected.dramaSlug)} · EP {selected.episodeNumber}</h3></div><button onClick={() => setSelected(null)} aria-label="Close">×</button></div>
        <p>{selected.videoLabel || (selected.videoKind === "hook" ? "Hook video" : `Episode ${selected.episodeNumber}`)}</p>
        <div className="publish-calendar-platforms">{selected.platforms.map((platform) => <span key={platform.source}>{platformNames[platform.source] || platform.source}</span>)}</div>
        <video src={selected.videoUrl} controls preload="metadata" />
        <a href={selected.videoUrl} target="_blank" rel="noreferrer"><Play /> Open video <ExternalLink /></a>
      </div>}
    </section>
  );
}
