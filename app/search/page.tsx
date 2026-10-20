import { redirect } from "next/navigation";
import { trackingQuery } from "@/lib/tracking";
export default async function SearchPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const query=await searchParams;const q=typeof query.q==="string"?query.q:"";const attribution=trackingQuery(query);const params=new URLSearchParams(attribution);if(q)params.set("q",q);redirect(`/${params.size?`?${params}`:""}#find-by-code`)}
