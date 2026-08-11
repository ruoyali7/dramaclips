import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { DramaCard } from "@/components/drama-card";
import { SearchBox } from "@/components/search-box";
import { dramas, findDrama } from "@/lib/demo-data";
export const metadata={title:"Find a story",robots:{index:false,follow:false}};
export default async function SearchPage({searchParams}:{searchParams:Promise<{q?:string}>}){const resolved=await searchParams;const q=(resolved.q||"").trim().toLowerCase();const exact=q?findDrama(q):undefined;const matches=exact?[exact]:q?dramas.filter(d=>d.title.toLowerCase().includes(q)||d.tags.some(t=>t.toLowerCase().includes(q))):[];return <main className="search-page"><header><Link href="/"><ArrowLeft/></Link><Brand/></header><div className="search-head"><span className="kicker">Find by title, drama code, or ReelShort code</span><h1>{matches.length?`${matches.length} match${matches.length>1?"es":""}`:"Let's find it."}</h1><SearchBox compact/><p>{q && !matches.length ? `No exact match for “${q}”. Check the code or explore a popular story below.` : q ? `Results for “${q}”` : "Enter the code shown in the video or ReelShort promotion."}</p></div><div className="card-grid">{(matches.length?matches:dramas.slice(0,3)).map(d=><DramaCard key={d.id} drama={d}/>)}</div></main>}
