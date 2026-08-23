"use client";
import type { MouseEvent, ReactNode } from "react";

export function FullSeriesLink({ href, appPromotionHref, code, children }: { href: string; appPromotionHref?: string; code?: string; children: ReactNode }) {
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!appPromotionHref) return;
    event.preventDefault();
    if (code) { try { await navigator.clipboard.writeText(code); } catch { /* Continue without clipboard permission. */ } }
    window.location.assign(appPromotionHref);
  }
  return <a href={appPromotionHref || href} onClick={open}>{children}</a>;
}
