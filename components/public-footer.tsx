import Link from "next/link";
import { Brand } from "./brand";
export function PublicFooter() { return <footer className="public-footer"><Brand dark/><p>Great stories, one tap away.</p><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms & disclosure</Link><span>© 2026 DramaClips</span></div></footer>; }
