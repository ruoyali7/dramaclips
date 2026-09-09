# DramaClips Phase 3 PRD — Content Operations & Publishing

**Status:** Active implementation source of truth  
**Supersedes:** Phase 2 planning  
**Scope decision (2026-09-08):** All built-in Generate Hook work is paused and does not block this PRD. The historical filename is retained so existing references do not break.

## 1. Product outcome

The active operator workflow is:

`Authorized drama/assets → R2 or Vizard asset → Publish Center → review copy/accounts/time → explicit confirmation → Yixiaoer or Metricool CSV → status/recovery → tracking and analytics`

DramaClips remains one private, single-operator admin. It does not add a second admin or a separate publishing workflow.

## 2. Active scope

### 2.1 Content and assets

- Add and manage authorized drama metadata and R2 episode assets.
- Import operator-authorized RS Boost metadata through the existing user-triggered extension flow.
- Submit work to Vizard and retain returned assets in R2.
- Allow Publish Center to select an original episode, an existing saved hook, a Vizard asset, or a manual upload.
- Preserve immutable asset identity, URL, kind, and label on each publish package.

Existing saved hooks may continue to be selected as assets. Creating new hooks inside DramaClips is outside active scope.

### 2.2 Publishing

- Keep Yixiaoer as the active direct-publishing provider.
- Support TikTok, Instagram Reels, YouTube Shorts, and Facebook with per-platform accounts and copy.
- Support immediate publishing and future scheduling.
- Require explicit confirmation before any real publish.
- Persist upload, validation, scheduling, publishing, published, failed, canceled, and outcome-unknown states.
- Reconcile ambiguous outcomes before retrying and prevent duplicate posts.
- Preserve Metricool CSV as fallback.
- Keep provider-neutral migration deferred until a second provider is selected or Yixiaoer coupling blocks required work.

### 2.3 Copy and conversion

- Use database-backed drama title, Content Code, promotion link, and asset metadata.
- Keep platform copy independently editable before confirmation.
- Put Content Code first and preserve the direct ReelShort promotion link for Facebook.
- Do not invent plot claims or describe DramaClips as hosting a full drama when it only provides a preview flow.
- Keep Code copies and RS redirects as the primary Analytics metrics.

### 2.4 Reliability and operations

- Supabase is the system of record for assets, packages, jobs, attempts, and tracking events.
- Vercel handles pages, short API requests, validation, and queue triggers.
- Railway workers handle durable provider, ingestion, and other long-running work.
- R2 stores media; browser signed uploads must bypass Vercel request bodies.
- Jobs must be idempotent, recoverable, observable at start and terminal/failure states, and safe to cancel.

## 3. Runtime and cost constraints

Every new design must state its expected request frequency, peak concurrency, execution location, retry behavior, and media/data volume.

- Do not run video processing, transcription, AI ranking, provider upload loops, or other CPU-intensive/long work in Vercel Functions.
- Avoid unbounded polling, retries, dynamic rendering, and repeated uncached reads.
- Prefer event-driven or adaptively throttled refreshes; stop polling in terminal states and when the page is hidden where practical.
- Measure Vercel Requests, Function Duration, Fluid Active CPU, errors, and relevant data transfer before and after production release.
- Record a usage baseline before release and review the 24-hour and 7-day increment afterward.
- A feature is not fully accepted when its observed usage materially exceeds the design estimate without explanation or mitigation.
- Cost or quota pressure must degrade non-critical refresh/automation safely rather than breaking publishing state integrity.

## 4. Explicitly paused and optional

The following are not active deliverables and must not be automatically implemented:

- built-in Hook Studio generation;
- episode analysis, Whisper transcription, scene detection, AI/rule candidate ranking, and semantic reranking;
- built-in FFmpeg hook composition and first-frame generation;
- hook candidate scoring, deduplication, opening/cover text generation, and hook review workflows;
- further development of the existing hook worker unless required to disable, secure, or preserve already-stored data.

The preserved optional specification is [`optional-built-in-hook-generation.md`](./optional-built-in-hook-generation.md). Existing code and data remain in place but are dormant product capability, not evidence that the optional feature is active or accepted.

## 5. Deferred learning loop

After publishing reliability is accepted:

- reconcile provider post IDs and final status;
- import available platform metrics;
- associate posts with drama, asset/hook ID, copy version, provider, and publish time;
- connect views and retention to landing visits, Content Code copies, RS redirects, orders, and revenue where authoritative data exists;
- never treat a click as an order or claim learned ranking without sufficient samples and a defined evaluation.

## 6. Acceptance criteria

- An authorized asset can be selected, previewed, and stored immutably on a publish package.
- Per-platform accounts and full captions can be reviewed and edited before confirmation.
- Immediate and scheduled publishing survive browser closure.
- Retries cannot duplicate an already confirmed successful post.
- Outcome-unknown attempts are reconciled before retry.
- Queued or active work can be canceled safely where the provider permits it.
- Metricool CSV remains downloadable when direct publishing is unavailable.
- Production evidence distinguishes Vercel deployment, Railway execution, Supabase migration, and provider result.
- Standard tests, typecheck, build, and `git diff --check` pass.
- Vercel usage is compared with the pre-release baseline after deployment.

## 7. Required production evidence

Use [`phase-3-production-qa.md`](./phase-3-production-qa.md) to record one real, authorized validation flow. Provider credentials or permissions may be recorded as blocked; they must not be presented as passing.
