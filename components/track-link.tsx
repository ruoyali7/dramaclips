"use client";
import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
export function TrackLink({ href, label = "Continue watching" }: { href: string; label?: string }) { const [loading,setLoading]=useState(false); return <a href={href} onClick={()=>setLoading(true)} className="primary-cta" aria-busy={loading}>{loading ? <LoaderCircle className="spin"/> : <><span>{label}</span><ArrowUpRight/></>}</a>; }
