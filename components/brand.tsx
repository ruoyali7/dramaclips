import Link from "next/link";
export function Brand({ dark = false }: { dark?: boolean }) { return <Link className={`brand ${dark ? "brand-dark" : ""}`} href="/" aria-label="Dramora AI home"><span className="brand-mark">DA</span><span>DRAMORA <b>AI</b></span></Link>; }
