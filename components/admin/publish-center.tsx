"use client";
import {
  Check,
  CloudUpload,
  Copy,
  LoaderCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultPublishTime, PublishTimePicker } from "@/components/admin/publish-time-picker";
import { PublishCalendar } from "@/components/admin/publish-calendar";
type Hook = {
  id: string;
  title: string;
  sourceEpisodes: number[];
  videoUrl: string;
  durationSeconds: number;
};
type DraftHook = Hook & { score: number; jobId: string };
type Source = {
  id: string;
  title: string;
  slug: string;
  language: string;
  coverUrl: string;
  episodes: { episodeNumber: number; videoUrl: string }[];
  hooks: Hook[];
  draftHooks: DraftHook[];
  vizardProjects: { id: string; episodeNumber: number; finalVideoUrl?: string; finalLabel?: string; editInfo: Record<string, unknown> }[];
  vizardAssets: { id: string; episodeNumber: number; title: string; videoUrl: string; durationSeconds: number }[];
};
type Pack = { source: string; hook: string; caption: string };
type Package = {
  id: string;
  dramaSlug: string;
  episodeNumber: number;
  videoUrl: string;
  videoKind: string;
  videoLabel?: string;
  scheduledAt?: string;
  status: string;
  platforms: Pack[];
  createdAt: string;
  yixiaoerVideo?: Record<string, unknown>;
  yixiaoerResults?: Record<string, unknown>;
  yixiaoerAction?: "validate" | "publish";
  yixiaoerAccounts?: Record<string, string>;
  yixiaoerProgress?: number;
  yixiaoerError?: string;
  yixiaoerUpdatedAt?: string;
};
type YAccount = { id: string; name: string; platform: string; status: number };
type DeliveryMode = "draft" | "now" | "scheduled";
type AssetRow = {
  key: string;
  sourceId: string;
  dramaSlug: string;
  dramaTitle: string;
  kind: "original" | "hook" | "draft" | "vizard";
  assetId: string;
  label: string;
  detail: string;
  videoUrl: string;
  r2State: string;
  latest?: Package;
};
const options = [
  ["tiktok", "TikTok"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["facebook", "Facebook"],
  ["x", "X (CSV fallback)"],
] as const;
const yNames: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "Youtube",
  facebook: "Facebook",
};
const stageNames: Record<string, string> = {
  awaiting_scheduled_time: "Waiting for scheduled publish time",
  downloading_from_r2: "Downloading video from R2",
  uploading_to_yixiaoer: "Uploading video to Yixiaoer",
  uploading_cover_to_yixiaoer: "Uploading cover to Yixiaoer",
  preparing_platform_validation: "Preparing platform validation",
  validating_platform: "Validating platform",
  submitting_platform: "Submitting to platform",
  reconciling_platform: "Confirming live platform status",
  saving_to_yixiaoer_draft: "Saving to Yixiaoer drafts",
};
function operationOf(value: Package) {
  const operation = value.yixiaoerResults?._operation;
  return operation && typeof operation === "object"
    ? (operation as Record<string, unknown>)
    : null;
}
function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}
function localTime(value: unknown, timeZone?: string) {
  if (typeof value !== "string") return "Waiting for heartbeat";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(value));
}
function cancelRequested(value: Package) {
  const control = value.yixiaoerResults?._control;
  return Boolean(
    control &&
    typeof control === "object" &&
    (control as Record<string, unknown>).cancelRequested,
  );
}
function packageState(value: Package) {
  const draft = value.yixiaoerResults?._draft;
  if (draft && typeof draft === "object" && (draft as Record<string, unknown>).state === "saved")
    return "Saved in Yixiaoer drafts";
  if (value.status === "published") return "Published · confirmed";
  if (value.status === "outcome_unknown") return "Needs reconciliation";
  if (value.status === "submitted" || value.status === "reconciling")
    return "Submitted · confirming";
  if (value.status === "scheduled") return "Scheduled";
  if (value.status === "failed" && value.yixiaoerError === "Canceled by user")
    return "Canceled";
  if (value.status === "failed") return "Failed";
  if (value.yixiaoerAction)
    return cancelRequested(value)
      ? "Canceling"
      : value.status === "publishing"
        ? "Publishing"
        : "Processing";
  if (Object.keys(value.yixiaoerVideo || {}).length) return "Dry-run passed";
  return "Generated only";
}
function platformState(value: Package, platform: string) {
  const draft = value.yixiaoerResults?._draft;
  if (draft && typeof draft === "object" && (draft as Record<string, unknown>).state === "saved")
    return "Saved in Yixiaoer draft";
  const result = value.yixiaoerResults?.[platform];
  if (result && typeof result === "object") {
    const state = String((result as Record<string, unknown>).state || "");
    if (state === "published") return "Published · confirmed";
    if (state === "failed") return "Failed · retry";
    if (state === "outcome_unknown")
      return (result as Record<string, unknown>).providerRequestId
        ? "Needs confirmation"
        : "Manual check required";
    if (["submitted", "processing", "submitting"].includes(state))
      return "Processing";
    if ((result as Record<string, unknown>).preview) return "Validated";
    if ((result as Record<string, unknown>).publish) return "Submitted";
  }
  if (value.status === "published") return "Published · confirmed";
  if (value.yixiaoerAction) return "Queued";
  if (value.status === "failed") return "Not published";
  return "Not started";
}
function deliveryMethod(value: Package) {
  const intent = value.yixiaoerResults?._intent;
  if (value.yixiaoerResults?._draft || (intent && typeof intent === "object" && (intent as Record<string, unknown>).deliveryMode === "draft")) return "Yixiaoer draft";
  if (value.scheduledAt) return "Scheduled";
  return "Publish now";
}
function taskCanContinue(value: Package) {
  const state = packageState(value);
  return ![
    "Published · confirmed",
    "Saved in Yixiaoer drafts",
  ].includes(state);
}
export function PublishCenter({
  sources,
  yixiaoerReady,
}: {
  sources: Source[];
  yixiaoerReady: boolean;
}) {
  const [sourceId, setSourceId] = useState(sources[0]?.id || "");
  const source = sources.find((x) => x.id === sourceId);
  const [kind, setKind] = useState<"original" | "hook" | "upload">("original");
  const [asset, setAsset] = useState("");
  const [videoUrl, setVideoUrl] = useState(source?.episodes[0]?.videoUrl || "");
  const [platforms, setPlatforms] = useState<string[]>([
    "tiktok",
    "instagram",
    "youtube",
    "facebook",
  ]);
  const [account, setAccount] = useState("");
  const [campaign, setCampaign] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultPublishTime);
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("draft");
  const [created, setCreated] = useState<Package | null>(null);
  const [recent, setRecent] = useState<Package[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [accounts, setAccounts] = useState<YAccount[]>([]);
  const [accountIds, setAccountIds] = useState<Record<string, string>>({});
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [validated, setValidated] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historySize, setHistorySize] = useState(5);
  const [savingCopy, setSavingCopy] = useState(false);
  const [assetDramaFilter, setAssetDramaFilter] = useState("all");
  const [showCalendar, setShowCalendar] = useState(true);
  const resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    fetch("/api/admin/publish-packages")
      .then(async (r) => (r.ok ? (await r.json()).packages : []))
      .then(setRecent)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!created || !created.yixiaoerAction) return;
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch("/api/admin/publish-packages", {
          cache: "no-store",
        });
        const json = await response.json();
        if (!response.ok) return;
        const packages: Package[] = json.packages || [];
        setRecent(packages);
        const next = packages.find((item) => item.id === created.id);
        if (next) {
          setCreated(next);
          if (next.status === "ready" && !next.yixiaoerAction)
            setValidated(true);
        }
      } catch {}
    }, 3000);
    return () => window.clearInterval(timer);
  }, [created]);
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    if (!created?.yixiaoerAction) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [created?.yixiaoerAction]);
  const selectedEpisode =
    source?.episodes.find((x) => String(x.episodeNumber) === asset) ||
    source?.episodes[0];
  const hookOptions = source
    ? [...source.hooks, ...source.vizardAssets.map((asset) => ({ id: asset.id, title: asset.title, sourceEpisodes: [asset.episodeNumber], videoUrl: asset.videoUrl, durationSeconds: asset.durationSeconds }))]
    : [];
  const selectedHook =
    hookOptions.find((x) => x.id === asset) ||
    (kind === "hook" ? hookOptions[0] : undefined);
  const episodeNumber =
    kind === "hook"
      ? selectedHook?.sourceEpisodes[0] || 1
      : selectedEpisode?.episodeNumber || 1;
  const videoLabel =
    kind === "hook"
      ? selectedHook?.title
      : kind === "original"
        ? `EP ${episodeNumber}`
        : "Manual upload";
  const allCopy = useMemo(
    () =>
      created?.platforms
        .map((p) => `${p.source.toUpperCase()}\n${p.caption}`)
        .join("\n\n") || "",
    [created],
  );
  const assetRows = useMemo<AssetRow[]>(
    () =>
      sources.flatMap((item) => {
        const rows: AssetRow[] = [
          ...item.episodes.map((ep) => ({
            key: `original:${item.id}:${ep.episodeNumber}`,
            sourceId: item.id,
            dramaSlug: item.slug,
            dramaTitle: item.title,
            kind: "original" as const,
            assetId: String(ep.episodeNumber),
            label: `EP ${ep.episodeNumber}`,
            detail: "Original episode",
            videoUrl: ep.videoUrl,
            r2State: "Available",
          })),
          ...item.hooks.map((hook) => ({
            key: `hook:${hook.id}`,
            sourceId: item.id,
            dramaSlug: item.slug,
            dramaTitle: item.title,
            kind: "hook" as const,
            assetId: hook.id,
            label: hook.title,
            detail: `Saved hook · EP ${hook.sourceEpisodes.join(", ")} · ${Math.round(hook.durationSeconds)}s`,
            videoUrl: hook.videoUrl,
            r2State: "Saved",
          })),
          ...item.draftHooks.map((hook) => ({
            key: `draft:${hook.id}`,
            sourceId: item.id,
            dramaSlug: item.slug,
            dramaTitle: item.title,
            kind: "draft" as const,
            assetId: hook.id,
            label: hook.title,
            detail: `Review needed · EP ${hook.sourceEpisodes.join(", ")} · score ${Math.round(hook.score)}`,
            videoUrl: hook.videoUrl,
            r2State: "Draft",
          })),
          ...item.vizardProjects.filter((project) => project.finalVideoUrl).map((project) => ({
            key: `vizard:${project.id}`, sourceId: item.id, dramaSlug: item.slug, dramaTitle: item.title,
            kind: "vizard" as const, assetId: project.id, label: project.finalLabel || `Vizard · EP ${project.episodeNumber}`,
            detail: `Vizard edit · EP ${project.episodeNumber}`, videoUrl: project.finalVideoUrl!, r2State: "Final",
          })),
          ...item.vizardAssets.map((asset) => ({
            key: `vizard-clip:${asset.id}`, sourceId: item.id, dramaSlug: item.slug, dramaTitle: item.title,
            kind: "vizard" as const, assetId: asset.id, label: asset.title, detail: `Vizard clip · EP ${asset.episodeNumber} · ${Math.round(asset.durationSeconds)}s`, videoUrl: asset.videoUrl, r2State: "R2",
          })),
        ];
        return rows.map((row) => ({
          ...row,
          latest: recent.find((pack) => pack.videoUrl === row.videoUrl),
        }));
      }),
    [sources, recent],
  );
  const dramaGroups = useMemo(
    () =>
      sources
        .filter((item) => assetDramaFilter === "all" || item.id === assetDramaFilter)
        .map((item) => {
          const assets = assetRows.filter((row) => row.sourceId === item.id);
          const packages = recent.filter((pack) => pack.dramaSlug === item.slug);
          const publishedPackages = packages.filter((pack) => pack.status === "published");
          const uploaded = new Set(
            packages
              .filter((pack) => Object.keys(pack.yixiaoerVideo || {}).length)
              .map((pack) => pack.videoUrl),
          );
          const publishedVideos = new Set(publishedPackages.map((pack) => pack.videoUrl));
          const publishedPlatforms = Array.from(
            new Set(publishedPackages.flatMap((pack) => pack.platforms.map((platform) => platform.source))),
          );
          return {
            source: item,
            assets,
            packages,
            uploaded,
            publishedVideos,
            publishedPlatforms,
            published: publishedPackages.length,
            scheduled: packages.filter((pack) => pack.status === "scheduled").length,
            processing: packages.filter((pack) => Boolean(pack.yixiaoerAction) && pack.status !== "scheduled").length,
            failed: packages.filter((pack) => pack.status === "failed" || pack.status === "outcome_unknown").length,
          };
        }),
    [sources, assetRows, recent, assetDramaFilter],
  );
  const activeOperation = created ? operationOf(created) : null;
  const draftSaved = Boolean(
    created?.yixiaoerResults?._draft &&
      typeof created.yixiaoerResults._draft === "object" &&
      (created.yixiaoerResults._draft as Record<string, unknown>).state === "saved",
  );
  const activeStarted =
    typeof activeOperation?.startedAt === "string"
      ? Date.parse(activeOperation.startedAt)
      : NaN;
  const activeElapsed = Number.isFinite(activeStarted)
    ? Math.max(0, Math.floor((clock - activeStarted) / 1000))
    : Number(activeOperation?.elapsedSeconds || 0);
  const activeStage = activeOperation?.stage
    ? stageNames[String(activeOperation.stage)] || String(activeOperation.stage)
    : "Waiting for Railway worker";
  const historyPool = created
    ? recent.filter((item) => item.id !== created.id)
    : recent;
  const historyPages = Math.max(1, Math.ceil(historyPool.length / historySize));
  const currentHistoryPage = Math.min(historyPage, historyPages);
  const historyItems = historyPool.slice(
    (currentHistoryPage - 1) * historySize,
    currentHistoryPage * historySize,
  );
  const attentionCount = recent.filter(
    (item) => item.status === "failed" || item.status === "outcome_unknown",
  ).length;
  const activeCount = recent.filter(
    (item) => Boolean(item.yixiaoerAction) && item.status !== "scheduled",
  ).length;
  const scheduledCount = recent.filter((item) => item.status === "scheduled").length;
  const supportedAccountPlatforms =
    created?.platforms
      .map((pack) => pack.source)
      .filter((platform) => Boolean(yNames[platform])) || [];
  const selectedAccountCount = supportedAccountPlatforms.filter((platform) =>
    Boolean(accountIds[platform]),
  ).length;
  const allAccountsSelected =
    selectedAccountCount === supportedAccountPlatforms.length &&
    supportedAccountPlatforms.length > 0;
  function resetFor(
    id: string,
    nextKind: "original" | "hook" | "upload" = "original",
  ) {
    const next = sources.find((x) => x.id === id);
    setSourceId(id);
    setKind(nextKind);
    const nextHooks = next ? [...next.hooks, ...next.vizardAssets.map((asset) => ({ id: asset.id, title: asset.title, sourceEpisodes: [asset.episodeNumber], videoUrl: asset.videoUrl, durationSeconds: asset.durationSeconds }))] : [];
    if (nextKind === "hook" && nextHooks[0]) {
      setAsset(nextHooks[0].id);
      setVideoUrl(nextHooks[0].videoUrl);
    } else {
      setAsset(String(next?.episodes[0]?.episodeNumber || ""));
      setVideoUrl(
        nextKind === "original" ? next?.episodes[0]?.videoUrl || "" : "",
      );
    }
    setCreated(null);
    setValidated(false);
    setScheduledAt(defaultPublishTime());
  }
  function changeAsset(value: string) {
    setAsset(value);
    setVideoUrl(
      kind === "original"
        ? source?.episodes.find((x) => String(x.episodeNumber) === value)
            ?.videoUrl || ""
        : hookOptions.find((x) => x.id === value)?.videoUrl || "",
    );
    setCreated(null);
    setValidated(false);
  }
  async function upload(file: File) {
    if (!source) return;
    setUploading(true);
    setError("");
    try {
      const p = await fetch("/api/admin/uploads/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
          slug: source.slug,
          kind: "social",
        }),
      });
      const data = await p.json();
      if (!p.ok) throw new Error(data.message);
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        x.open("PUT", data.uploadUrl);
        x.setRequestHeader("Content-Type", file.type || "video/mp4");
        x.upload.onprogress = (e) =>
          e.lengthComputable &&
          setProgress(Math.round((e.loaded / e.total) * 100));
        x.onload = () =>
          x.status < 300 ? resolve() : reject(new Error("R2 upload failed"));
        x.onerror = () => reject(new Error("R2 upload failed"));
        x.send(file);
      });
      setVideoUrl(data.publicUrl);
      setProgress(100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  async function create() {
    if (!source || !videoUrl || !platforms.length) return;
    if (deliveryMode === "scheduled" && new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Choose a scheduled time in the future");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/admin/publish-packages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dramaSlug: source.slug,
          episodeNumber,
          videoUrl,
          videoKind: kind,
          videoLabel,
          hookClipId: kind === "hook" ? selectedHook?.id : undefined,
          account,
          campaign,
          deliveryMode,
          scheduledAt: deliveryMode === "scheduled" && scheduledAt
            ? new Date(scheduledAt).toISOString()
            : undefined,
          platforms,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setCreated(j.package);
      setRecent((x) => [j.package, ...x]);
      await loadAccounts();
      window.requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create package");
    } finally {
      setBusy(false);
    }
  }
  async function loadAccounts(
    targetPlatforms = platforms,
    preferred: Record<string, string> = {},
  ) {
    if (!yixiaoerReady) return;
    setConnectionBusy(true);
    try {
      const r = await fetch("/api/admin/yixiaoer/accounts");
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setAccounts(j.accounts);
      const next: Record<string, string> = {};
      for (const platform of targetPlatforms) {
        const matches = j.accounts.filter(
          (a: YAccount) =>
            a.platform.toLowerCase() === yNames[platform]?.toLowerCase(),
        );
        if (
          preferred[platform] &&
          matches.some((a: YAccount) => a.id === preferred[platform])
        )
          next[platform] = preferred[platform];
        else if (matches.length === 1) next[platform] = matches[0].id;
      }
      setAccountIds(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setConnectionBusy(false);
    }
  }
  async function yAction(action: "draft" | "validate" | "publish") {
    if (!created) return;
    const future =
      Boolean(created.scheduledAt) &&
      new Date(created.scheduledAt as string).getTime() > Date.now();
    if (
      (action === "publish" || action === "draft") &&
      !window.confirm(
        action === "draft"
          ? "Save this package to Yixiaoer drafts? This will not publish to any social platform."
          : future
          ? `Schedule this package for ${new Date(created.scheduledAt as string).toLocaleString()}? Railway will send it to the selected live accounts at that time.`
          : "This will publish immediately to the selected live social accounts. Continue?",
      )
    )
      return;
    setConnectionBusy(true);
    setError("");
    try {
      await persistCopy();
      const r = await fetch(
        `/api/admin/publish-packages/${created.id}/yixiaoer`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            confirm: action === "publish",
            accounts: accountIds,
          }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setCreated(j.package);
      setRecent((items) =>
        items.map((item) => (item.id === j.package.id ? j.package : item)),
      );
      setValidated(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yixiaoer operation failed");
    } finally {
      setConnectionBusy(false);
    }
  }
  function editCopy(source: string, field: "hook" | "caption", value: string) {
    if (!created) return;
    setCreated({
      ...created,
      platforms: created.platforms.map((pack) =>
        pack.source === source ? { ...pack, [field]: value } : pack,
      ),
    });
  }
  async function persistCopy() {
    if (!created) return null;
    const r = await fetch(`/api/admin/publish-packages/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platforms: created.platforms }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.message);
    setCreated(j.package);
    setRecent((items) =>
      items.map((item) => (item.id === j.package.id ? j.package : item)),
    );
    return j.package as Package;
  }
  async function saveCopy() {
    setSavingCopy(true);
    setError("");
    try {
      await persistCopy();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save copy");
    } finally {
      setSavingCopy(false);
    }
  }
  async function cancelOperation() {
    if (
      !created?.yixiaoerAction ||
      !window.confirm(
        "Stop the current Yixiaoer operation? Nothing will be published after the worker stops.",
      )
    )
      return;
    setConnectionBusy(true);
    setError("");
    try {
      const r = await fetch(
        `/api/admin/publish-packages/${created.id}/yixiaoer`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "cancel" }),
        },
      );
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setCreated(j.package);
      setRecent((items) =>
        items.map((item) => (item.id === j.package.id ? j.package : item)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel operation");
    } finally {
      setConnectionBusy(false);
    }
  }
  async function platformAction(
    item: Package,
    action: "reconcile" | "retry",
    platform: string,
  ) {
    const message = action === "reconcile"
      ? `Query Yixiaoer for the latest ${platform} result before retrying?`
      : `Retry publishing to ${platform}? Already confirmed platforms will not be submitted again.`;
    if (!window.confirm(message)) return;
    setError("");
    try {
      const r = await fetch(`/api/admin/publish-packages/${item.id}/yixiaoer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, platform, accounts: item.yixiaoerAccounts || {} }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message);
      setRecent((items) => items.map((current) => current.id === item.id ? j.package : current));
      if (created?.id === item.id) setCreated(j.package);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update platform operation");
    }
  }
  function openPackage(item: Package) {
    const next = sources.find((x) => x.slug === item.dramaSlug);
    const nextPlatforms = item.platforms.map((pack) => pack.source);
    if (next) setSourceId(next.id);
    setKind(item.videoKind as "original" | "hook" | "upload");
    setAsset(item.videoKind === "original" ? String(item.episodeNumber) : "");
    setVideoUrl(item.videoUrl);
    setPlatforms(nextPlatforms);
    setCreated(item);
    setDeliveryMode(
      item.yixiaoerResults?._draft ||
      (item.yixiaoerResults?._intent && typeof item.yixiaoerResults._intent === "object" && (item.yixiaoerResults._intent as Record<string, unknown>).deliveryMode === "draft")
        ? "draft"
        : item.scheduledAt
          ? "scheduled"
          : "now",
    );
    if (item.scheduledAt) {
      const local = new Date(item.scheduledAt);
      const offset = local.getTimezoneOffset() * 60000;
      setScheduledAt(new Date(local.getTime() - offset).toISOString().slice(0, 16));
    }
    setAccountIds(item.yixiaoerAccounts || {});
    setValidated(
      item.status === "ready" &&
        Object.keys(item.yixiaoerVideo || {}).length > 0,
    );
    setError("");
    if (!item.yixiaoerAction && item.status !== "published")
      void loadAccounts(nextPlatforms, item.yixiaoerAccounts || {});
    document
      .querySelector(".asset-selection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function selectAsset(row: AssetRow) {
    if (row.kind === "draft") {
      const jobId =
        sources
          .find((item) => item.id === row.sourceId)
          ?.draftHooks.find((hook) => hook.id === row.assetId)?.jobId || "";
      window.location.href = `/admin/hooks?job=${jobId}`;
      return;
    }
    setSourceId(row.sourceId);
    setKind(row.kind === "vizard" ? "upload" : row.kind);
    setAsset(row.assetId);
    setVideoUrl(row.videoUrl);
    setCreated(null);
    setValidated(false);
    setError("");
    document
      .querySelector(".asset-selection")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1200);
  }
  if (!sources.length)
    return (
      <div className="admin-empty">
        <Send />
        <h2>No published dramas</h2>
      </div>
    );
  return (
    <div className="publish-center">
      <section className="publish-calendar-shell">
        <div className="publish-view-toggle"><b>Publishing overview</b><div><button className={showCalendar ? "selected" : ""} onClick={() => setShowCalendar(true)}>Calendar</button><button className={!showCalendar ? "selected" : ""} onClick={() => setShowCalendar(false)}>List</button></div></div>
        {showCalendar && <PublishCalendar packages={recent} sources={sources} />}
      </section>
      <section className="asset-library">
        <span>01 · Video asset library</span>
        <div className="publish-summary" aria-label="Publish queue summary">
          <span><b>{recent.length}</b><small>Tasks</small></span>
          <span><b>{activeCount}</b><small>Processing</small></span>
          <span><b>{scheduledCount}</b><small>Scheduled</small></span>
          <span className={attentionCount ? "attention" : ""}><b>{attentionCount}</b><small>Needs attention</small></span>
        </div>
        <div className="asset-filters">
          <select
            value={assetDramaFilter}
            onChange={(e) => setAssetDramaFilter(e.target.value)}
          >
            <option value="all">All dramas</option>
            {sources.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
          <small>One row per drama. Expand only when you need a specific video.</small>
        </div>
        <div className="drama-ledger-head">
          <b>Drama</b><b>Episodes</b><b>Hooks</b><b>Distribution</b><b>Status</b>
        </div>
        <div className="drama-ledger">
          {dramaGroups.map((group) => (
            <details className="drama-asset-row" key={group.source.id}>
              <summary>
                <div className="drama-cell"><img src={group.source.coverUrl} alt=""/><div><b>{group.source.title}</b><small>{group.source.slug}</small></div></div>
                <div className="asset-chips">{group.source.episodes.map((ep) => <i key={ep.episodeNumber} className={group.publishedVideos.has(ep.videoUrl) ? "published" : ""}>EP {ep.episodeNumber}</i>)}</div>
                <div className="asset-chips hook-chips">
                  {group.source.hooks.map((hook) => <i key={hook.id} className={group.publishedVideos.has(hook.videoUrl) ? "published" : ""}>EP {hook.sourceEpisodes[0]}</i>)}
                  {!group.source.hooks.length && <small>No saved hooks</small>}
                  {group.source.draftHooks.length > 0 && <small>{group.source.draftHooks.length} need review</small>}
                </div>
                <div><b>{group.uploaded.size} uploaded</b><small>{group.publishedPlatforms.length ? group.publishedPlatforms.join(" · ") : `${group.published} published · ${group.scheduled} scheduled`}</small></div>
                <div className="drama-status">{group.processing ? <span className="working">Processing</span> : group.scheduled ? <span className="scheduled">Scheduled</span> : group.failed ? <span className="failed">Needs attention</span> : group.published ? <span className="published">Published</span> : <span>Ready</span>}<small>Expand details</small></div>
              </summary>
              <div className="drama-assets-expanded">
                <div className="expanded-section"><b>Original episodes</b><div>{group.assets.filter((row) => row.kind === "original").map((row) => <article key={row.key}><span>{row.label}</span><small>{group.uploaded.has(row.videoUrl) ? "Uploaded to Yixiaoer" : "R2 only"} · {row.latest ? packageState(row.latest) : "Never published"}</small>{row.latest && <button onClick={() => openPackage(row.latest!)}>Open task</button>}<button onClick={() => selectAsset(row)}>Use video</button></article>)}</div></div>
                <div className="expanded-section"><b>Hooks</b><div>{group.assets.filter((row) => row.kind !== "original").map((row) => <article key={row.key}><span>{row.label}</span><small>{row.detail} · {row.latest ? packageState(row.latest) : "Never published"}</small>{row.latest && <button onClick={() => openPackage(row.latest!)}>Open task</button>}<button onClick={() => selectAsset(row)}>{row.kind === "draft" ? "Review" : "Use video"}</button></article>)}{!group.source.hooks.length && !group.source.draftHooks.length && <p>No hooks generated yet.</p>}</div></div>
              </div>
            </details>
          ))}
          {!dramaGroups.length && <p className="asset-empty">No drama matches this filter.</p>}
        </div>
      </section>
      <section className="publish-compose asset-selection">
        <span>02 · Exact video asset</span>
        <label>
          <b>Drama</b>
          <select value={sourceId} onChange={(e) => resetFor(e.target.value)}>
            {sources.map((x) => (
              <option value={x.id} key={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
        <div className="asset-kind">
          {(["original", "hook", "upload"] as const).map((x) => (
            <button
              className={kind === x ? "selected" : ""}
              key={x}
              onClick={() => resetFor(sourceId, x)}
            >
              {x === "original"
                ? "Original episode"
                : x === "hook"
                  ? "Saved hook"
                  : "Manual upload"}
            </button>
          ))}
        </div>
        {kind !== "upload" && (
          <label>
            <b>Specific video</b>
            <select
              value={
                asset ||
                String(
                  kind === "original"
                    ? source?.episodes[0]?.episodeNumber
                    : hookOptions[0]?.id || "",
                )
              }
              onChange={(e) => changeAsset(e.target.value)}
            >
              {kind === "original"
                ? source?.episodes.map((x) => (
                    <option value={x.episodeNumber} key={x.episodeNumber}>
                      EP {x.episodeNumber}
                    </option>
                  ))
                : hookOptions.map((x) => (
                    <option value={x.id} key={x.id}>
                      {x.title} · {x.durationSeconds}s
                    </option>
                  ))}
            </select>
          </label>
        )}
        <div className="video-source">
          <b>{videoLabel}</b>
          {videoUrl ? (
            <details>
              <summary>
                Technical source · Railway uses this exact R2 file
              </summary>
              <code>{videoUrl}</code>
            </details>
          ) : (
            <small>No video selected</small>
          )}
        </div>
        {videoUrl && (
          <video
            className="publish-preview"
            src={videoUrl}
            controls
            preload="metadata"
          />
        )}
        {kind === "upload" && (
          <label className="social-upload">
            <input
              type="file"
              accept="video/mp4,video/quicktime"
              onChange={(e) =>
                e.target.files?.[0] && void upload(e.target.files[0])
              }
            />
            <CloudUpload />
            <b>
              {uploading
                ? `Uploading · ${progress}%`
                : "Upload a finished video to R2"}
            </b>
          </label>
        )}
      </section>
      <section className="publish-compose">
        <span>03 · Choose delivery</span>
        <div className="delivery-mode-picker">
          {([
            ["draft", "Save Yixiaoer draft", "Upload and save for review. Nothing is sent to social platforms."],
            ["now", "Publish now · 2 steps", "Prepare the task here, then validate and confirm live publish below."],
            ["scheduled", "Schedule publish", "Validate now. Railway sends it at the selected time."],
          ] as const).map(([mode, title, description]) => (
            <button
              type="button"
              key={mode}
              className={deliveryMode === mode ? "selected" : ""}
              onClick={() => {
                setDeliveryMode(mode);
                setCreated(null);
                setValidated(false);
              }}
            >
              <b>{title}</b>
              <small>{description}</small>
            </button>
          ))}
        </div>
        <div className="platform-picker">
          <span>Platforms</span>
          <div>
            {options.map(([v, l]) => (
              <label
                className={platforms.includes(v) ? "selected" : ""}
                key={v}
              >
                <input
                  type="checkbox"
                  checked={platforms.includes(v)}
                  onChange={() => {
                    setPlatforms((x) =>
                      x.includes(v) ? x.filter((p) => p !== v) : [...x, v],
                    );
                    setCreated(null);
                    setValidated(false);
                  }}
                />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div className="publish-grid">
          <label>
            <b>Account label · optional</b>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            />
          </label>
          <label>
            <b>Campaign · optional</b>
            <input
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </label>
          {deliveryMode === "scheduled" && (
            <label>
              <b>Scheduled publish time</b>
              <PublishTimePicker value={scheduledAt} onChange={setScheduledAt} />
            </label>
          )}
        </div>
        <button
          className="save-draft"
          onClick={() => void create()}
          disabled={!videoUrl || !platforms.length || busy || Boolean(created)}
        >
          {busy ? <LoaderCircle className="spin" /> : <Send />}
          {created
            ? "Task prepared · continue below"
            : busy
            ? "Preparing task…"
            : deliveryMode === "draft"
              ? "Prepare Yixiaoer draft"
              : deliveryMode === "scheduled"
                ? "Prepare scheduled publish"
                : "Prepare immediate publish"}
        </button>
        {error && <div className="form-error">{error}</div>}
      </section>
      {created && (
        <section className="publish-results" ref={resultsRef}>
          <div className="pack-heading">
            <div>
              <span>{packageState(created)}</span>
              <b>
                {source?.title || created.dramaSlug} · {created.videoLabel}
              </b>
            </div>
          </div>
          {!created.yixiaoerAction && created.status !== "published" && !draftSaved && (
            <div className="publish-next-step" role="status">
              <b>
                {deliveryMode === "draft"
                  ? "Next: choose the publishing accounts, then save to Yixiaoer drafts."
                  : "Next: choose the publishing accounts, run validation, then confirm publishing."}
              </b>
              <small>
                Preparing a task does not publish it. The final action is completed in this panel.
              </small>
            </div>
          )}
          {created.yixiaoerError && (
            <div className="form-error">{created.yixiaoerError}</div>
          )}
          {created.yixiaoerAction && (
            <div className="publish-process">
              <div className="process-title">
                <div>
                  <span>Railway → Yixiaoer</span>
                  <b>
                    {activeStage}
                    {activeOperation?.platform
                      ? ` · ${String(activeOperation.platform)}`
                      : ""}
                  </b>
                </div>
                <div className="process-actions">
                  <strong>{created.yixiaoerProgress || 0}%</strong>
                  <button
                    onClick={() => void cancelOperation()}
                    disabled={connectionBusy || cancelRequested(created)}
                  >
                    {cancelRequested(created) ? "Canceling…" : "Cancel"}
                  </button>
                </div>
              </div>
              <div className="process-track">
                <i style={{ width: `${created.yixiaoerProgress || 0}%` }} />
              </div>
              <div className="process-meta">
                {created.status === "scheduled" ? (
                  <>
                    <span>
                      Publishes ·{" "}
                      {created.scheduledAt
                        ? new Date(created.scheduledAt).toLocaleString()
                        : "Not set"}
                    </span>
                    <span>Railway will start automatically</span>
                    <span>
                      China ·{" "}
                      {created.scheduledAt
                        ? new Intl.DateTimeFormat(undefined, {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "Asia/Shanghai",
                          }).format(new Date(created.scheduledAt))
                        : "Not set"}
                    </span>
                  </>
                ) : (
                  <>
                    <span>Running · {durationLabel(activeElapsed)}</span>
                    <span>
                      Last heartbeat ·{" "}
                      {localTime(
                        activeOperation?.heartbeatAt ||
                          created.yixiaoerUpdatedAt,
                      )}
                    </span>
                    <span>
                      China ·{" "}
                      {localTime(
                        activeOperation?.heartbeatAt ||
                          created.yixiaoerUpdatedAt,
                        "Asia/Shanghai",
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          <details className="copy-editor">
            <summary>
              <div>
                <b>Generated account copy</b>
                <small>
                  {created.platforms.length} account version(s) · expand to
                  review or edit
                </small>
              </div>
              <span>Expand</span>
            </summary>
            <div className="copy-toolbar">
              <button onClick={() => void copy(allCopy, "all")}>
                {copied === "all" ? <Check /> : <Copy />} Copy all
              </button>
              <button
                onClick={() => void saveCopy()}
                disabled={
                  savingCopy ||
                  Boolean(created.yixiaoerAction) ||
                  created.status === "published"
                }
              >
                {savingCopy ? "Saving…" : "Save edits"}
              </button>
            </div>
            {created.platforms.map((pack) => (
              <details className="copy-account" key={pack.source}>
                <summary>
                  <b>{pack.source}</b>
                  <span>Review & edit</span>
                </summary>
                <label>
                  <b>Hook line</b>
                  <textarea
                    value={pack.hook}
                    disabled={
                      Boolean(created.yixiaoerAction) ||
                      created.status === "published"
                    }
                    onChange={(e) =>
                      editCopy(pack.source, "hook", e.target.value)
                    }
                  />
                </label>
                <label>
                  <b>Full caption</b>
                  <textarea
                    className="caption-editor"
                    value={pack.caption}
                    disabled={
                      Boolean(created.yixiaoerAction) ||
                      created.status === "published"
                    }
                    onChange={(e) =>
                      editCopy(pack.source, "caption", e.target.value)
                    }
                  />
                </label>
                <button onClick={() => void copy(pack.caption, pack.source)}>
                  {copied === pack.source ? <Check /> : <Copy />} Copy{" "}
                  {pack.source}
                </button>
              </details>
            ))}
          </details>
          {created.status !== "published" && !created.yixiaoerAction && !draftSaved && (
            <details className="account-routing" open={!allAccountsSelected}>
              <summary>
                <div>
                  <b>Publishing accounts</b>
                  <small>
                    {selectedAccountCount}/{supportedAccountPlatforms.length}{" "}
                    selected
                  </small>
                </div>
                <span>{allAccountsSelected ? "Ready" : "Action required"}</span>
              </summary>
              <div className="account-routing-body">
                <p>
                  Refresh only after adding, removing, or reconnecting an
                  account in Yixiaoer.
                </p>
                <button
                  onClick={() => void loadAccounts(platforms, accountIds)}
                  disabled={connectionBusy || !yixiaoerReady}
                >
                  {connectionBusy ? "Refreshing…" : "Refresh accounts"}
                </button>
                {supportedAccountPlatforms.map((p) => (
                  <label className="yixiaoer-account" key={p}>
                    <b>{yNames[p]} account</b>
                    <select
                      value={accountIds[p] || ""}
                      onChange={(e) => {
                        setAccountIds((x) => ({ ...x, [p]: e.target.value }));
                        setValidated(false);
                      }}
                    >
                      <option value="">Choose account</option>
                      {accounts
                        .filter(
                          (a) =>
                            a.platform.toLowerCase() ===
                            yNames[p].toLowerCase(),
                        )
                        .map((a) => (
                          <option value={a.id} key={a.id}>
                            {a.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          )}
          {created.status !== "published" && !created.yixiaoerAction && (
            <div className="yixiaoer-actions">
              {deliveryMode === "draft" ? (
                <button
                  className="publish-live"
                  onClick={() => void yAction("draft")}
                  disabled={connectionBusy || !yixiaoerReady || !allAccountsSelected || draftSaved}
                >
                  <ShieldCheck /> {draftSaved ? "Saved in Yixiaoer drafts" : "Save to Yixiaoer drafts"}
                </button>
              ) : (
                <>
                  <button
                    onClick={() => void yAction("validate")}
                    disabled={connectionBusy || !yixiaoerReady || !allAccountsSelected}
                  >
                    <ShieldCheck /> {Object.keys(created.yixiaoerVideo || {}).length ? "Re-run validation" : "Upload, validate & dry-run"}
                  </button>
                  <button
                    className="publish-live"
                    onClick={() => void yAction("publish")}
                    disabled={connectionBusy || !validated || !allAccountsSelected}
                  >
                    <Send /> {deliveryMode === "scheduled" ? "Confirm scheduled publish" : "Confirm live publish"}
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}
      {recent.length > 0 && (
        <section className="publish-history publish-monitor">
          <span>04 · Publishing tasks</span>
          <p className="task-help">
            Use this list to check delivery status, reopen unfinished tasks, or inspect completed results. Opening a task never republishes it.
          </p>
          <div className="monitor-head">
            <b>Task</b>
            <b>Method</b>
            <b>Asset</b>
            <b>Outcome</b>
          </div>
          {historyItems.map((x) => {
            const uploaded = Boolean(Object.keys(x.yixiaoerVideo || {}).length);
            return (
              <details key={x.id}>
                <summary>
                  <b>
                    {x.dramaSlug}
                    <small>
                      {x.videoLabel || `EP ${x.episodeNumber}`}
                      {x.id === created?.id ? " · Open" : ""}
                    </small>
                  </b>
                  <span>{deliveryMethod(x)}</span>
                  <span>
                    {uploaded
                      ? "Uploaded"
                      : x.yixiaoerAction
                        ? `${x.yixiaoerProgress || 0}%`
                        : "Not uploaded"}
                  </span>
                  <span className={`delivery ${x.status}`}>
                    {packageState(x)}
                  </span>
                </summary>
                <div className="monitor-detail">
                  <div className="history-actions">
                    <code>{x.id}</code>
                    <button onClick={() => openPackage(x)}>
                      {x.id === created?.id
                        ? "Currently open"
                        : taskCanContinue(x)
                          ? "Open & continue"
                          : "View details"}
                    </button>
                  </div>
                  {x.yixiaoerError && <p>{x.yixiaoerError}</p>}
                  {x.platforms.map((pack) => {
                    const result = x.yixiaoerResults?.[pack.source];
                    const state = result && typeof result === "object"
                      ? String((result as Record<string, unknown>).state || "")
                      : "";
                    return (
                      <div key={pack.source}>
                        <b>{pack.source}</b>
                        <span>{platformState(x, pack.source)}</span>
                        {state === "outcome_unknown" && Boolean((result as Record<string, unknown>)?.providerRequestId) && (
                          <button onClick={() => void platformAction(x, "reconcile", pack.source)}>Reconcile</button>
                        )}
                        {state === "failed" && (
                          <button onClick={() => void platformAction(x, "retry", pack.source)}>Retry platform</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
          <div className="history-pagination">
            <label>
              Rows{" "}
              <select
                value={historySize}
                onChange={(e) => {
                  setHistorySize(Number(e.target.value));
                  setHistoryPage(1);
                }}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
              </select>
            </label>
            <span>
              Page {currentHistoryPage} of {historyPages}
            </span>
            <div>
              <button
                onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                disabled={currentHistoryPage === 1}
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setHistoryPage((page) => Math.min(historyPages, page + 1))
                }
                disabled={currentHistoryPage === historyPages}
              >
                Next
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
