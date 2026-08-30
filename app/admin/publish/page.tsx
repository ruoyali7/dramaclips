import {
  Activity,
  Cloud,
  Database,
  Download,
  ExternalLink,
  Rocket,
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { PublishCenter } from "@/components/admin/publish-center";
import { listVizardSources } from "@/lib/admin/repository";
import { approveHookCandidate, listHookClips } from "@/lib/admin/hook-repository";
import { listHookJobs } from "@/lib/admin/hook-job-repository";
import { yixiaoerConfigured } from "@/lib/admin/yixiaoer";
import { listVizardProjects } from "@/lib/admin/vizard-repository";
import { listLibraryAssets } from "@/lib/admin/asset-library";
import "../asset-library.css";
import "../compact-hook-preview.css";
import "../publish-library-refinements.css";

export const dynamic = "force-dynamic";
export default async function Page() {
  const [base, initialHooks, hookJobs, yixiaoerReady, vizardProjects] = await Promise.all([
    listVizardSources(),
    listHookClips(),
    listHookJobs(undefined, 100),
    yixiaoerConfigured(),
    listVizardProjects(),
  ]);
  const savedCandidateIds = new Set(initialHooks.map((hook) => hook.candidateId).filter(Boolean));
  await Promise.all(
    hookJobs.flatMap((job) =>
      job.candidates
        .filter((candidate) => candidate.draftUrl && !savedCandidateIds.has(candidate.id))
        .map((candidate) => approveHookCandidate(job, candidate, candidate.title).catch(() => null)),
    ),
  );
  const libraryAssets = await listLibraryAssets();
  const hooks = libraryAssets.filter((asset) => asset.kind === "hook");
  const persistedCandidateIds = new Set(initialHooks.map((hook) => hook.candidateId).filter(Boolean));
  const sources = base.map((source) => ({
    ...source,
    libraryAssets: libraryAssets.filter((asset) => asset.dramaSlug === source.slug),
    hooks: hooks.filter((hook) => hook.dramaSlug === source.slug).map((hook) => ({
      id: hook.id, title: hook.title, sourceEpisodes: [hook.episodeNumber], videoUrl: hook.videoUrl, durationSeconds: hook.durationSeconds,
    })),
    builtInAssets: hookJobs
      .filter((job) => job.dramaSlug === source.slug)
      .flatMap((job) =>
        job.candidates
          .filter((candidate) => candidate.draftUrl && !persistedCandidateIds.has(candidate.id))
          .map((candidate) => ({
            id: candidate.id,
            title: candidate.title,
            sourceEpisodes: job.sourceEpisodes,
            videoUrl: candidate.draftUrl!,
            durationSeconds: candidate.durationSeconds || 0,
          })),
      ),
    draftHooks: [],
    vizardProjects: vizardProjects.filter((project) => project.dramaSlug === source.slug),
    vizardAssets: [],
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
        <a href="https://railway.app/dashboard" target="_blank" rel="noreferrer">
          <Rocket /> Railway deploy portal <ExternalLink />
        </a>
        <a href="/api/admin/publish-packages/latest/csv" download>
          <Download /> CSV fallback
        </a>
      </nav>
      <PublishCenter sources={sources} yixiaoerReady={yixiaoerReady} />
    </AdminShell>
  );
}
