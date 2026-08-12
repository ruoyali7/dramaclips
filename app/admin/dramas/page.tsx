import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { DeleteDramaButton } from "@/components/admin/delete-drama-button";
import { listDramaDrafts } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ published?: string;deleted?:string }> }) {
  const query = await searchParams;
  const drafts = await listDramaDrafts();
  return <AdminShell active="Dramas & R2">
    <div className="admin-title"><div><p>Content library</p><h1>Dramas & R2</h1></div><Link className="admin-primary" href="/admin/dramas/new">+ Add drama</Link></div>
    {query.published && <div className="admin-notice">Drama published. It is now available on the public catalog and Vizard Studio.</div>}
    {query.deleted && <div className="admin-notice">Drama deleted. Its R2 files were kept.</div>}
    <section className="panel draft-panel"><div className="panel-head"><div><span>Content pipeline</span><h2>Drama bundles</h2></div></div>
      {drafts.length ? <table><thead><tr><th>Drama</th><th>Code</th><th>R2 episodes</th><th>Status</th><th>Action</th></tr></thead><tbody>{drafts.map((drama) => <tr key={drama.id}><td><div><b>{drama.title}</b><small>/{drama.slug}</small></div></td><td>{drama.publicCode}</td><td>{drama.episodeCount}</td><td><span className={drama.status === "published" ? "status" : "draft-status"}>● {drama.status}</span></td><td><div className="table-actions"><Link href={`/admin/dramas/${drama.id}/edit`}>Edit</Link>{drama.status === "draft" ? <form action={`/api/admin/dramas/${drama.id}/publish`} method="post"><button className="publish-button">Publish</button></form> : <><Link href={`/watch/${drama.slug}`} target="_blank">View ↗</Link><Link href="/admin/vizard">Vizard →</Link></>}<DeleteDramaButton id={drama.id} title={drama.title}/></div></td></tr>)}</tbody></table> : <div className="admin-empty"><h2>No dramas yet</h2><p>Add a drama and upload its preview episodes directly to R2.</p><Link className="admin-primary" href="/admin/dramas/new">Add first drama</Link></div>}
    </section>
  </AdminShell>;
}
