import Link from "next/link";
import { Brand } from "./brand";
export function SiteHeader() { return <header className="site-header"><Brand/><nav><Link href="/#discover">Discover</Link><Link href="/privacy">Privacy</Link></nav></header>; }
