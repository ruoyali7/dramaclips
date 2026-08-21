import {
  Activity,
  Cloud,
  Database,
  Download,
  ExternalLink,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PublishCenter } from "@/components/admin/publish-center";
import { listVizardSources } from "@/lib/admin/repository";
import { listHookClips } from "@/lib/admin/hook-repository";
import { listHookJobs } from "@/lib/admin/hook-job-repository";
import { yixiaoerConfigured } from "@/lib/admin/yixiaoer";
import { listVizardAssets, listVizardProjects } from "@/lib/admin/vizard-repository";
import "../asset-library.css";

export const dynamic = "force-dynamic";
export default async function Page() {
  const [base, hooks, hookJobs, yixiaoerReady, vizardProjects, vizardAssets] = await Promise.all([
    listVizardSources(),
    listHookClips(),
    listHookJobs(undefined, 25),
    yixiaoerConfigured(),
    listVizardProjects(),
    listVizardAssets(),
  ]);
  const sources = base.map((source) => ({
    ...source,
    hooks: hooks.filter((hook) => hook.dramaSlug === source.slug),
    draftHooks: hookJobs
      .filter(
        (job) => job.dramaSlug === source.slug && job.status === "review_ready",
      )
      .flatMap((job) =>
        job.candidates
          .filter(
            (candidate) =>
              candidate.reviewState === "pending" && candidate.draftUrl,
          )
          .map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            sourceEpisodes: job.sourceEpisodes,
            videoUrl: candidate.draftUrl!,
            durationSeconds: candidate.durationSeconds || 0,
            score: candidate.score,
            jobId: job.id,
          })),
      ),
    vizardProjects: vizardProjects.filter((project) => project.dramaSlug === source.slug),
    vizardAssets: vizardAssets.filter((asset) => asset.dramaSlug === source.slug),
  }));
  const r2Account = process.env.R2_ACCOUNT_ID?.trim();
  const r2Bucket = process.env.R2_BUCKET_NAME?.trim();
  const r2Url =
    r2Account && r2Bucket
      ? `https://dash.cloudflare.com/${encodeURIComponent(r2Account)}/r2/default/buckets/${encodeURIComponent(r2Bucket)}`
      : "https://dash.cloudflare.com/?to=/:account/r2";
  return (
    <AdminShell active="Publish Center">
      <div className="admin-title">
        <div>
          <p>Final distribution</p>
          <h1>Publish Center</h1>
        </div>
      </div>
      <nav className="publish-operations" aria-label="Publishing operations">
        <span>Operations</span>
        <a
          href="https://vercel.com/drama-clips/dramaclips/logs"
          target="_blank"
          rel="noreferrer"
        >
          <Activity /> Vercel logs <ExternalLink />
        </a>
        <a
          href="https://supabase.com/dashboard/project/ijywiyedtkuugoksquvq/editor?schema=public&table=publish_packages"
          target="_blank"
          rel="noreferrer"
        >
          <Database /> Supabase packages <ExternalLink />
        </a>
        <a href={r2Url} target="_blank" rel="noreferrer">
          <Cloud /> R2 bucket <ExternalLink />
        </a>
        <a href="https://www.yixiaoer.cn/" target="_blank" rel="noreferrer">
          Yixiaoer console <ExternalLink />
        </a>
      </nav>
      <div className="publish-intro">
        <div>
          <b>Choose the exact asset to distribute.</b>
          <p>
            See every original and hook in one ledger, then continue the exact
            asset without generating duplicate uploads.
          </p>
        </div>
        <a href="/api/admin/publish-packages/latest/csv" download>
          <Download /> CSV fallback
        </a>
      </div>
      <PublishCenter sources={sources} yixiaoerReady={yixiaoerReady} />
    </AdminShell>
  );
}
