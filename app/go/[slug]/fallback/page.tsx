import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Brand } from "@/components/brand";
import { DramaCard } from "@/components/drama-card";
import { dramas } from "@/lib/demo-data";
export const metadata={title:"Story temporarily unavailable",robots:{index:false,follow:false}};
export default function Fallback(){return <main className="fallback"><Brand/><div className="fallback-card"><AlertCircle/><span className="kicker">A brief intermission</span><h1>This story is taking a pause.</h1><p>The destination isn’t available for your device or region right now. Try again shortly, or choose another story.</p><Link href="/"><ArrowLeft/> Back to stories</Link></div><section><h2>Keep exploring</h2><div className="card-grid">{dramas.slice(1,3).map(d=><DramaCard drama={d} key={d.id}/>)}</div></section></main>}
