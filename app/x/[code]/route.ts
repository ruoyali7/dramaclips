import { NextRequest,NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getShortLink,recordTrackingEvent } from "@/lib/admin/analytics-repository";
import { getDramaBySlug } from "@/lib/catalog";
import { detectDevice } from "@/lib/redirect";

export const dynamic="force-dynamic";
export async function GET(request:NextRequest,{params}:{params:Promise<{code:string}>}){const {code}=await params;try{const link=await getShortLink(code);if(!link)return NextResponse.redirect(new URL("/?link=expired",request.url),302);const drama=await getDramaBySlug(link.dramaSlug);if(!drama)return NextResponse.redirect(new URL("/?link=unavailable",request.url),302);const sessionId=request.cookies.get("db_session")?.value||randomUUID();const device=detectDevice(request.headers.get("user-agent")||"");try{await recordTrackingEvent({name:"short_link_click",sessionId,dramaId:drama.id,dramaSlug:drama.slug,shortCode:link.code,source:link.source,account:link.account,campaign:link.campaign,clip:link.clip,device})}catch{/* A temporary analytics failure must not break a valid viewer link. */}const query=new URLSearchParams({s:link.source,a:link.account,c:link.campaign,cl:link.clip,sl:link.code});const response=NextResponse.redirect(new URL(`/watch/${drama.slug}?${query}`,request.url),302);response.cookies.set("db_session",sessionId,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:60*60*24*30,path:"/"});return response}catch{return NextResponse.redirect(new URL("/?link=unavailable",request.url),302)}}
