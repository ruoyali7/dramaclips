import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { DramaCreateForm } from "@/components/admin/drama-create-form";
import { getDramaForEdit } from "@/lib/admin/repository";

export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;const drama=await getDramaForEdit(id);if(!drama)notFound();const account=process.env.R2_ACCOUNT_ID?.trim();const bucket=process.env.R2_BUCKET_NAME?.trim();const r2DashboardUrl=account&&bucket?`https://dash.cloudflare.com/${encodeURIComponent(account)}/r2/default/buckets/${encodeURIComponent(bucket)}`:"https://dash.cloudflare.com/?to=/:account/r2";return <AdminShell active="Dramas & R2"><div className="admin-title"><div><p>Content library · {drama.status}</p><h1>Edit drama</h1></div></div><DramaCreateForm r2DashboardUrl={r2DashboardUrl} initialDrama={drama}/></AdminShell>}
