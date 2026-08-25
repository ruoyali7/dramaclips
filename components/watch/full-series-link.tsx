"use client";
import type { MouseEvent, ReactNode } from "react";

export function FullSeriesLink({ href, contentPromotionHref, code, children }: { href: string; contentPromotionHref?: string; code?: string; children: ReactNode }) {
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!contentPromotionHref) return;
    event.preventDefault();
    if (code) { try { await navigator.clipboard.writeText(code); } catch { /* Continue without clipboard permission. */ } }
    window.location.assign(contentPromotionHref);
  }
  return <a href={contentPromotionHref || href} onClick={open}>{children}</a>;
}
