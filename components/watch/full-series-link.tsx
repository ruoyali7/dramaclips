"use client";
import type { MouseEvent, ReactNode } from "react";

function track(name:string, dramaId:string, dramaSlug:string, metadata:Record<string,string>={}) {
  const body=JSON.stringify({eventId:crypto.randomUUID(),name,schemaVersion:1,occurredAt:new Date().toISOString(),tracking:Object.fromEntries(new URLSearchParams(window.location.search)),dramaId,dramaSlug,metadata});
  if(navigator.sendBeacon) navigator.sendBeacon("/api/events",new Blob([body],{type:"application/json"}));
  else void fetch("/api/events",{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true});
}

export function FullSeriesLink({ href, contentPromotionHref, code, dramaId, dramaSlug, children }: { href: string; contentPromotionHref?: string; code?: string; dramaId:string; dramaSlug:string; children: ReactNode }) {
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!contentPromotionHref) return;
    event.preventDefault();
    if (code) { try { await navigator.clipboard.writeText(code); track("promo_code_copy",dramaId,dramaSlug,{reason:"mobile_bottom"}); } catch { /* Continue without clipboard permission. */ } }
    track("rs_redirect_click",dramaId,dramaSlug,{destination:"content_promotion",position:"mobile_bottom"});
    window.location.assign(contentPromotionHref);
  }
  return <a href={contentPromotionHref || href} onClick={open}>{children}</a>;
}
