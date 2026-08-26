import Link from "next/link";

export function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <Link className={`brand ${dark ? "brand-dark" : ""}`} href="/" aria-label="Dramora AI home">
      <img className="brand-mark" src="/branding/dramora-ai-icon-logo.png" alt="" />
      <span>Dramora <b>AI</b></span>
    </Link>
  );
}
