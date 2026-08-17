import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { DeleteDramaButton } from "@/components/admin/delete-drama-button";
import { listHookJobs } from "@/lib/admin/hook-job-repository";
import { listDramaDrafts } from "@/lib/admin/repository";

export const dynamic = "force-dynamic";
const uploadedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function Page({ searchParams }: { searchParams: Promise<{ published?: string;deleted?:string }> }) {
  const query = await searchParams;
  const [drafts, jobs] = await Promise.all([listDramaDrafts(), listHookJobs(undefined, 25)]);
  const latestJobs = new Map(jobs.map((job) => [job.dramaId, job]));
  return <AdminShell active="Dramas & R2">
    <div className="admin-title"><div><p>Content library</p><h1>Dramas & R2</h1></div><Link className="admin-primary" href="/admin/dramas/new">+ Add drama</Link></div>
    {query.published && <div className="admin-notice">Drama published. It is now available on the public catalog and Hook Studio.</div>}
    {query.deleted && <div className="admin-notice">Drama deleted. Its R2 files were kept.</div>}
    <section className="panel draft-panel"><div className="panel-head"><div><span>Content pipeline</span><h2>Drama bundles</h2></div></div>
      {drafts.length ? <table><thead><tr><th>Drama</th><th>Code</th><th>R2 episodes</th><th>Uploaded</th><th>Status</th><th>Hooks</th><th>Action</th></tr></thead><tbody>{drafts.map((drama) => {
        const hook = latestJobs.get(drama.id);
        const hookCount = hook?.candidates.length || 0;
        return <tr key={drama.id}><td><span className="mini-cover drama-cover" style={{backgroundImage:`url("${drama.coverUrl.replaceAll('"','%22')}")`}}/><div><b>{drama.title}</b><small>/{drama.slug}</small></div></td><td>{drama.publicCode}</td><td>{drama.episodeCount}</td><td><span className="upload-date">{uploadedDate.format(new Date(drama.createdAt))}</span></td><td><span className={drama.status === "published" ? "status" : "draft-status"}>● {drama.status}</span></td><td>{hook ? <Link className={`hook-link ${hook.status}`} href={`/admin/hooks?dramaId=${drama.id}`}>{hookCount ? `${hookCount} hook${hookCount === 1 ? "" : "s"} · Review` : `${hook.status.replaceAll("_", " ")} · ${hook.progress}%`}</Link> : <span className="no-hooks">—</span>}</td><td><div className="table-actions"><Link href={`/admin/dramas/${drama.id}/edit`}>Edit</Link>{drama.status === "draft" ? <form action={`/api/admin/dramas/${drama.id}/publish`} method="post"><button className="publish-button">Publish</button></form> : <Link href={`/watch/${drama.slug}`} target="_blank">View ↗</Link>}<DeleteDramaButton id={drama.id} title={drama.title}/></div></td></tr>;
      })}</tbody></table> : <div className="admin-empty"><h2>No dramas yet</h2><p>Add a drama and upload its preview episodes directly to R2.</p><Link className="admin-primary" href="/admin/dramas/new">Add first drama</Link></div>}
    </section>
  </AdminShell>;
}
