"use client";

import type { MouseEvent, ReactNode } from "react";
import { trackClientEvent } from "@/lib/client-events";

type AffiliateCtaProps = {
  href: string;
  code?: string;
  dramaId: string;
  dramaSlug: string;
  position: string;
  className?: string;
  children: ReactNode;
};

export function AffiliateCta({ href, code, dramaId, dramaSlug, position, className, children }: AffiliateCtaProps) {
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    if (code && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        trackClientEvent("promo_code_copy", {
          dramaId,
          dramaSlug,
          metadata: { reason: position === "mobile_bottom" ? "mobile_bottom" : "full_cta" }
        });
      } catch {
        // Clipboard access is optional; provider navigation must still continue.
      }
    }
    trackClientEvent("rs_redirect_click", {
      dramaId,
      dramaSlug,
      position,
      metadata: { destination: "content_promotion" }
    });
    window.location.assign(href);
  }

  return <a href={href} className={className} onClick={open}>{children}</a>;
}
