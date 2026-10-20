"use client";

import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rankDramaMatches } from "@/lib/catalog-routing";
import type { PublicDrama } from "@/lib/types";

export function SearchBox({ dramas, attribution = "", initialQuery = "" }: { dramas: PublicDrama[]; attribution?: string; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const suggestions = useMemo(() => rankDramaMatches(dramas, query), [dramas, query]);
  const attributionFields = Array.from(new URLSearchParams(attribution));

  function dramaHref(drama: PublicDrama) {
    return `/watch/${drama.slug}${attribution ? `?${attribution}` : ""}`;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (activeIndex >= 0 && suggestions[activeIndex]) {
      router.push(dramaHref(suggestions[activeIndex]));
      return;
    }
    const params = new URLSearchParams(attribution);
    params.set("q", value);
    router.push(`/?${params}#find-by-code`);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!suggestions.length || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    event.preventDefault();
    setOpen(true);
    setActiveIndex(current => event.key === "ArrowDown"
      ? (current + 1) % suggestions.length
      : (current <= 0 ? suggestions.length - 1 : current - 1));
  }

  return <form className="smart-search" action="/" onSubmit={submit}>
    <Search/>
    {attributionFields.map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
    <input
      name="q"
      value={query}
      onChange={event => { setQuery(event.target.value); setOpen(true); setActiveIndex(-1); }}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      onKeyDown={onKeyDown}
      enterKeyHint="search"
      placeholder="Search title or drama code..."
      aria-label="Drama title or code"
      role="combobox"
      aria-autocomplete="list"
      aria-controls="drama-suggestions"
      aria-expanded={open && Boolean(query.trim())}
      aria-activedescendant={activeIndex >= 0 ? `drama-suggestion-${activeIndex}` : undefined}
    />
    <button>Find</button>
    {open&&query.trim()&&<div className="search-suggestions" id="drama-suggestions" role="listbox">
      {suggestions.length?suggestions.map((drama, index) => <Link
        id={`drama-suggestion-${index}`}
        role="option"
        aria-selected={index === activeIndex}
        className={index === activeIndex ? "active" : ""}
        href={dramaHref(drama)}
        key={drama.id}
      ><Image src={drama.coverUrl} alt="" width={42} height={56}/><span><strong>{drama.title}</strong><small>Code {drama.promoCode || drama.publicCode}</small></span></Link>):<p>No matching drama found.</p>}
    </div>}
  </form>;
}
