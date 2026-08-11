"use client";
import { Search } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
export function SearchBox({ compact = false }: { compact?: boolean }) {
  const [q,setQ] = useState(""); const router = useRouter();
  function submit(e: FormEvent) { e.preventDefault(); if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }
  return <form className={`search-box ${compact ? "compact" : ""}`} onSubmit={submit}><Search size={20}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Title or ReelShort code, e.g. 3469908" aria-label="Drama code, ReelShort code, or title"/><button>Find story</button></form>;
}
