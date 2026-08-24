import "server-only";
import { createHash } from "node:crypto";
import { getSupabaseConfig } from "./supabase-config";
import { createShortLink } from "./analytics-repository";
import { recommendHashtags } from "./hashtag-recommendation";

export const publishingPlatforms = [
  "tiktok",
  "instagram",
  "youtube",
  "facebook",
  "x",
] as const;
export type PublishingPlatform = (typeof publishingPlatforms)[number];
type PlatformPack = {
  source: PublishingPlatform;
  shortCode: string;
  url: string;
  hook: string;
  cta: string;
  hashtags: string;
  hashtagSource: string;
  caption: string;
};
type Row = {
  id: string;
  drama_slug: string;
  episode_number: number;
  video_url: string;
  video_kind?: "original" | "hook" | "upload";
  video_label?: string;
  hook_clip_id?: string;
  account: string;
  campaign: string;
  scheduled_at?: string;
  status: string;
  platforms: PlatformPack[];
  metricool_post_ids: Record<string, string>;
  yixiaoer_video?: Record<string, unknown>;
  yixiaoer_payloads?: Record<string, unknown>;
  yixiaoer_results?: Record<string, unknown>;
  yixiaoer_action?: "validate" | "publish";
  yixiaoer_accounts?: Record<string, string>;
  yixiaoer_progress?: number;
  yixiaoer_error?: string;
  yixiaoer_lease_owner?: string;
  yixiaoer_lease_expires_at?: string;
  yixiaoer_updated_at?: string;
  created_at: string;
  updated_at: string;
};

async function request(path: string, init: RequestInit = {}) {
  const config = getSupabaseConfig();
  if (!config.configured) throw new Error("Supabase is not configured");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(
      `Supabase ${response.status}: ${(await response.text()).slice(0, 220)}`,
    );
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
function safe(row: Row) {
  return {
    id: row.id,
    dramaSlug: row.drama_slug,
    episodeNumber: row.episode_number,
    videoUrl: row.video_url,
    videoKind: row.video_kind || "original",
    videoLabel: row.video_label,
    hookClipId: row.hook_clip_id,
    account: row.account,
    campaign: row.campaign,
    scheduledAt: row.scheduled_at,
    status: row.status,
    platforms: row.platforms,
    metricoolPostIds: row.metricool_post_ids,
    yixiaoerVideo: row.yixiaoer_video || {},
    yixiaoerPayloads: row.yixiaoer_payloads || {},
    yixiaoerResults: row.yixiaoer_results || {},
    yixiaoerAction: row.yixiaoer_action,
    yixiaoerAccounts: row.yixiaoer_accounts || {},
    yixiaoerProgress: row.yixiaoer_progress || 0,
    yixiaoerError: row.yixiaoer_error,
    yixiaoerLeaseOwner: row.yixiaoer_lease_owner,
    yixiaoerUpdatedAt: row.yixiaoer_updated_at,
    createdAt: row.created_at,
  };
}
function shorten(value: string, max: number) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[,;:\s]+$/g, "")}…`;
}
function hashTag(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 28);
}
function uniqueTags(values: string[]) {
  return Array.from(new Set(values.map(hashTag).filter(Boolean))).slice(0, 7);
}
function copyFor(
  source: PublishingPlatform,
  title: string,
  episode: number,
  url: string,
  promoCode: string,
  description: string,
  tags: string[],
  hookLabel?: string,
) {
  const firstSentence =
    description.match(/^.+?[.!?](?:\s|$)/)?.[0] || description;
  const hookLead: Record<PublishingPlatform, string> = {
    tiktok: "😱 The secret is finally out:",
    instagram: "✨ This changes their relationship:",
    youtube: "👀 You won't expect what happens next:",
    facebook: "💔 One decision changes everything:",
    x: "😳 This scene changes everything:",
  };
  const hook = `${hookLead[source]} ${shorten(hookLabel || firstSentence, source === "x" ? 65 : 120)}`;
  const tagCandidates = [
    { tag: "ReelShort", relevance: 75, competition: 65 },
    { tag: "DramaClips", relevance: 95, competition: 45 },
    { tag: "ShortDrama", relevance: 95, competition: 60 },
    ...(source === "youtube" ? [{ tag: "Shorts", relevance: 85, competition: 80 }] : []),
    { tag: title, relevance: 90, competition: 25 },
    ...tags.slice(0, 3).map((tag) => ({ tag, relevance: 82, competition: 45 })),
    ...(hookLabel ? [{ tag: hookLabel, relevance: 65, competition: 35 }] : []),
  ];
  const tagSet = uniqueTags(recommendHashtags(source, tagCandidates).map((candidate) => candidate.tag)).map((tag) => `#${tag}`);
  const hashtagSource = "catalog-fallback";
  const top = `🔥 Watch now 👉 ${url}`;
  const code = `🔍 Search “${promoCode}” in ReelShort or DramaClips`;
  const cta = "👉🏻 Continue watching in the app";
  const hashtags = tagSet.join(" ");
  if (source === "x") {
    const fixed = `${top}\n${hook}\n${cta}\n${code}\n${hashtags}`;
    return { hook, cta, hashtags, hashtagSource, caption: shorten(fixed, 280) };
  }
  const descriptionLimit: Record<Exclude<PublishingPlatform, "x">, number> = {
    tiktok: 420,
    instagram: 700,
    youtube: 900,
    facebook: 1000,
  };
  const story = shorten(description, descriptionLimit[source]);
  const caption = [
    top,
    "🌟 Continue the story here",
    hook,
    `🎬 ${title} · EP ${episode}`,
    cta,
    code,
    `✨ ${story}`,
    hashtags,
  ].join("\n");
  return { hook, cta, hashtags, hashtagSource, caption };
}

export async function createPublishPackage(input: {
  dramaSlug: string;
  title: string;
  promoCode: string;
  description: string;
  descriptions?: Record<string, string>;
  tags: string[];
  episodeNumber: number;
  videoUrl: string;
  videoKind: "original" | "hook" | "upload";
  videoLabel?: string;
  hookClipId?: string;
  account?: string;
  campaign?: string;
  scheduledAt?: string;
  deliveryMode: "draft" | "now" | "scheduled";
  platforms: PublishingPlatform[];
  siteUrl: string;
}) {
  await request("publish_packages?select=id&limit=0");
  const priorRows = (await request(
    `publish_packages?video_url=eq.${encodeURIComponent(input.videoUrl)}&select=*&order=created_at.desc&limit=10`,
  )) as Row[];
  const reusable = priorRows.find((row) => {
    const stored = row.yixiaoer_video || {};
    const video = (stored.video || stored) as Record<string, unknown>;
    return typeof video.key === "string" && video.key.includes(row.id);
  });
  const reusableVideo = reusable
    ? { video: (reusable.yixiaoer_video?.video || reusable.yixiaoer_video) as Record<string, unknown> }
    : {};
  const replaceableFailure = priorRows.find((row) => {
    if (row.status !== "failed" || row.yixiaoer_action) return false;
    return !Object.values(row.yixiaoer_results || {}).some((value) => {
      if (!value || typeof value !== "object") return false;
      const state = String((value as Record<string, unknown>).state || "");
      return state === "published" || state === "outcome_unknown";
    });
  });
  const packs: PlatformPack[] = [];
  for (const source of input.platforms) {
    const link = await createShortLink({
      dramaSlug: input.dramaSlug,
      source,
      account: input.account,
      campaign: input.campaign,
      clip: `ep-${String(input.episodeNumber).padStart(2, "0")}`,
    });
    const url = `${input.siteUrl.replace(/\/$/, "")}/x/${link.code}`;
    packs.push({
      source,
      shortCode: link.code,
      url,
      ...copyFor(
        source,
        input.title,
        input.episodeNumber,
        url,
        input.promoCode,
        input.descriptions?.[source] || input.description,
        input.tags,
        input.videoKind === "hook" ? input.videoLabel : undefined,
      ),
    });
  }
  const packageBody = {
      drama_slug: input.dramaSlug,
      episode_number: input.episodeNumber,
      video_url: input.videoUrl,
      video_kind: input.videoKind,
      video_label: input.videoLabel || null,
      hook_clip_id: input.hookClipId || null,
      account: input.account || "main",
      campaign: input.campaign || "organic",
      scheduled_at: input.scheduledAt || null,
      status: "ready",
      platforms: packs,
      yixiaoer_video: reusableVideo,
      yixiaoer_payloads: {},
      yixiaoer_results: { _intent: { deliveryMode: input.deliveryMode } },
      yixiaoer_action: null,
      yixiaoer_accounts: {},
      yixiaoer_progress: 0,
      yixiaoer_error: null,
      yixiaoer_lease_owner: null,
      yixiaoer_lease_expires_at: null,
      updated_at: new Date().toISOString(),
    };
  const rows = (await request(replaceableFailure ? `publish_packages?id=eq.${encodeURIComponent(replaceableFailure.id)}` : "publish_packages", {
    method: replaceableFailure ? "PATCH" : "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(packageBody),
  })) as Row[];
  return safe(rows[0]);
}
export async function listPublishPackages() {
  const rows = (await request(
    "publish_packages?select=*&order=created_at.desc&limit=50",
  )) as Row[];
  return rows.map(safe);
}
export async function getLatestPublishPackage() {
  const rows = (await request(
    "publish_packages?select=*&order=created_at.desc&limit=1",
  )) as Row[];
  return rows[0] ? safe(rows[0]) : null;
}
export async function getPublishPackage(id: string) {
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
  )) as Row[];
  return rows[0] ? safe(rows[0]) : null;
}
export async function updatePublishPackagePlatforms(
  id: string,
  platforms: PlatformPack[],
) {
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ platforms, updated_at: new Date().toISOString() }),
    },
  )) as Row[];
  if (!rows[0]) throw new Error("Publish package not found");
  return safe(rows[0]);
}
export async function updatePublishPackageYixiaoer(
  id: string,
  input: {
    status?: string;
    video?: Record<string, unknown>;
    payloads?: Record<string, unknown>;
    results?: Record<string, unknown>;
  },
) {
  const body: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (input.status) body.status = input.status;
  if (input.video) body.yixiaoer_video = input.video;
  if (input.payloads) body.yixiaoer_payloads = input.payloads;
  if (input.results) body.yixiaoer_results = input.results;
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  )) as Row[];
  if (!rows[0]) throw new Error("Publish package not found");
  return safe(rows[0]);
}
export async function enqueueYixiaoerPackage(
  id: string,
  input: {
    action: "validate" | "publish";
    accounts: Record<string, string>;
    control?: {
      reconcilePlatforms?: string[];
      retryPlatform?: string;
      saveDraft?: boolean;
    };
  },
) {
  const item = await getPublishPackage(id);
  if (!item) throw new Error("Publish package not found");
  const scheduled =
    input.action === "publish" &&
    Boolean(item.scheduledAt) &&
    new Date(item.scheduledAt as string).getTime() > Date.now();
  const now = new Date().toISOString();
  const results = scheduled
    ? {
        ...item.yixiaoerResults,
        _operation: {
          stage: "awaiting_scheduled_time",
          scheduledAt: item.scheduledAt,
          queuedAt: now,
          heartbeatAt: now,
        },
      }
    : input.control
      ? { ...item.yixiaoerResults, _control: input.control }
      : item.yixiaoerResults;
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        status:
          input.action === "validate"
            ? "validating"
            : scheduled
              ? "scheduled"
              : "publishing",
        yixiaoer_action: input.action,
        yixiaoer_accounts: input.accounts,
        yixiaoer_progress: scheduled ? 0 : 1,
        yixiaoer_error: null,
        yixiaoer_results: results,
        yixiaoer_lease_owner: null,
        yixiaoer_lease_expires_at: null,
        yixiaoer_updated_at: now,
        updated_at: now,
      }),
    },
  )) as Row[];
  if (!rows[0]) throw new Error("Publish package not found");
  return safe(rows[0]);
}
export async function requestCancelYixiaoerPackage(id: string) {
  const item = await getPublishPackage(id);
  if (!item) throw new Error("Publish package not found");
  if (!item.yixiaoerAction) throw new Error("No Yixiaoer operation is running");
  const now = new Date().toISOString();
  if (item.status === "scheduled" && !item.yixiaoerLeaseOwner) {
    const {
      _operation: discardedOperation,
      _control: discardedControl,
      ...results
    } = item.yixiaoerResults;
    void discardedOperation;
    void discardedControl;
    const rows = (await request(
      `publish_packages?id=eq.${encodeURIComponent(id)}&status=eq.scheduled`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          status: "ready",
          yixiaoer_action: null,
          yixiaoer_progress: 0,
          yixiaoer_error: "Scheduled publish canceled",
          yixiaoer_results: results,
          yixiaoer_updated_at: now,
          updated_at: now,
        }),
      },
    )) as Row[];
    if (!rows[0])
      throw new Error(
        "Scheduled publish is already starting; cancel again to stop the worker",
      );
    return safe(rows[0]);
  }
  const results = {
    ...item.yixiaoerResults,
    _control: { cancelRequested: true, requestedAt: now },
  };
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        yixiaoer_results: results,
        yixiaoer_updated_at: now,
        updated_at: now,
      }),
    },
  )) as Row[];
  return safe(rows[0]);
}
export async function leaseYixiaoerPackage(
  workerId: string,
  leaseSeconds = 600,
) {
  const rows = (await request("rpc/lease_yixiaoer_publish_job", {
    method: "POST",
    body: JSON.stringify({
      p_worker_id: workerId,
      p_lease_seconds: leaseSeconds,
    }),
  })) as Row[];
  return rows[0] ? safe(rows[0]) : null;
}
export async function updateYixiaoerWorkerPackage(
  id: string,
  workerId: string,
  input: {
    status: string;
    progress: number;
    video?: Record<string, unknown>;
    payloads?: Record<string, unknown>;
    results?: Record<string, unknown>;
    error?: string;
    terminal?: boolean;
  },
) {
  const current = await getPublishPackage(id);
  const control = current?.yixiaoerResults?._control;
  const body: Record<string, unknown> = {
    status: input.status,
    yixiaoer_progress: input.progress,
    yixiaoer_error: input.error || null,
    yixiaoer_updated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    yixiaoer_lease_expires_at: input.terminal
      ? null
      : new Date(Date.now() + 600000).toISOString(),
  };
  if (input.video) body.yixiaoer_video = input.video;
  if (input.payloads) body.yixiaoer_payloads = input.payloads;
  if (input.results)
    body.yixiaoer_results = control
      ? { ...input.results, _control: control }
      : input.results;
  if (input.terminal) {
    body.yixiaoer_action = null;
    body.yixiaoer_lease_owner = null;
  }
  const rows = (await request(
    `publish_packages?id=eq.${encodeURIComponent(id)}&yixiaoer_lease_owner=eq.${encodeURIComponent(workerId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    },
  )) as Row[];
  if (!rows[0]) throw new Error("Yixiaoer lease not owned");
  if (input.results && current) {
    const now = new Date().toISOString();
    const attempts = current.platforms.flatMap((pack) => {
      const result = input.results?.[pack.source];
      if (!result || typeof result !== "object" || pack.source === "x")
        return [];
      const detail = result as Record<string, unknown>;
      const state = String(detail.state || "");
      if (
        ![
          "submitting",
          "submitted",
          "processing",
          "published",
          "failed",
          "outcome_unknown",
        ].includes(state)
      )
        return [];
      const accountId = String(current.yixiaoerAccounts?.[pack.source] || "");
      const idempotencyKey = createHash("sha256")
        .update(`${id}:${pack.source}:${accountId}`)
        .digest("hex");
      return [
        {
          package_id: id,
          platform: pack.source,
          account_id: accountId,
          idempotency_key: idempotencyKey,
          state,
          provider_request_id: detail.providerRequestId || null,
          platform_post_id: detail.platformPostId || null,
          provider_response: detail.reconciliation || detail.publish || {},
          error_message: detail.error || null,
          submitted_at: ["submitted", "processing", "published"].includes(state)
            ? now
            : null,
          reconciled_at: ["published", "failed"].includes(state) ? now : null,
          updated_at: now,
        },
      ];
    });
    if (attempts.length)
      await request(
        "publish_platform_attempts?on_conflict=package_id,platform",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(attempts),
        },
      );
  }
  return safe(rows[0]);
}
