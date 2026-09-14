import Link from "next/link";

export function Brand({ dark = false, href = "/" }: { dark?: boolean; href?: string }) {
  return (
    <Link className={`brand ${dark ? "brand-dark" : ""}`} href={href} aria-label="Dramora AI home">
      <img className="brand-mark" src="/branding/dramora-ai-icon-transparent-v2.png" alt="" />
      <span>Dramora <b>AI</b></span>
    </Link>
  );
}
