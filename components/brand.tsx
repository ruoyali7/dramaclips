import Link from "next/link";
export function Brand({ dark = false }: { dark?: boolean }) { return <Link className={`brand ${dark ? "brand-dark" : ""}`} href="/" aria-label="DramaClips home"><span className="brand-mark">DC</span><span>DRAMA<b>CLIPS</b></span></Link>; }
