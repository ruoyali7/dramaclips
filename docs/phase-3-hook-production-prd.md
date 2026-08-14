# DramaClips Phase 3 PRD — Hook Production & Direct Distribution

**Status:** Active implementation source of truth  
**Supersedes:** Phase 2 planning  
**Primary objective:** Turn authorized R2 drama episodes into one or two high-quality, reviewable social hooks, then publish a selected original or hook video through a provider-backed workflow with Metricool CSV retained as fallback.

## 1. Product outcome

The operator workflow is:

`Select R2 drama → select first 1–5 episodes → create hook job → review up to two finished hooks → save approved hooks to R2 → select original/hook/upload in Publish Center → publish now or schedule → track status`

The system must not mechanically return two clips. It returns one when only one candidate meets the quality threshold and returns an honest no-result state when none do.

## 2. Product principles

1. **Story understanding before decoration.** A title overlay is not a hook. Selection must consider dialogue, scene context, emotion, conflict, visual attraction, reversals, and cliffhanger potential.
2. **Human approval before durable storage or publishing.** Generated drafts remain temporary until the operator saves them to R2. Nothing publishes without final confirmation.
3. **First frame is the thumbnail.** Because some uploaders cannot supply a separate thumbnail, the strongest safe frame must be encoded at the actual beginning of the MP4.
4. **Long-running work is asynchronous.** Vercel request handlers create and inspect jobs; an independent worker performs downloads, transcription, analysis, and FFmpeg rendering.
5. **Provider abstraction, not lock-in.** Metricool CSV remains a fallback. Direct publishing providers are replaceable adapters.
6. **Official platform access only.** Do not use browser-session automation or scraping to upload. Use approved OAuth and official/provider APIs.
7. **Open-source license boundaries matter.** MIT components may be selectively adapted with attribution. AGPL systems such as Postiz/OpenPost must remain separate services accessed through APIs unless the project deliberately accepts AGPL obligations.

## 3. Open-source reference architecture

Use these projects as references, not wholesale monorepo imports:

- OpenShorts: https://github.com/mutonby/openshorts
  - Reference for Faster-Whisper, PySceneDetect, multimodal moment selection, FFmpeg rendering, reframe pipeline, async jobs, and API boundaries.
- ClippyMe: https://github.com/fralapo/clippyme
  - Reference for compose-on-demand editing, Smart Cut, hook controls, transcript trimming, job APIs, and publish handoff.
- OpenSource Clipping: https://github.com/NaufalRizqullah/opensource-clipping
  - Reference for multi-hook cold opens, animated subtitles, BGM ducking, ending cleanup, and cover extraction.
- skill-autoshorts: https://github.com/Upload-Post/skill-autoshorts
  - Reference for “Whisper is the clock; multimodal AI is the editor,” timestamp-grounded selection, and human approval.
- Postiz: https://github.com/gitroomhq/postiz-app
  - Optional independent publishing service; do not copy AGPL code into Drama Boost.
- OpenPost: https://github.com/getopenpost/openpost
  - Optional lightweight independent publishing service with S3-compatible storage and typed API; provider-format readiness requires live certification.
- Upload-Post SDK: https://github.com/upload-post/upload-post-pip
  - Candidate first direct-publishing adapter; SDK is open source but the underlying service is hosted.

Before adapting any source, Codex must verify the current license and record attribution in `THIRD_PARTY_NOTICES.md`.

## 4. Scope

### 4.1 Hook Studio

The admin interface must allow the operator to:

- select a published drama whose episodes already exist in R2;
- select the first 1–5 episodes;
- create one asynchronous analysis/render job;
- see queued, downloading, transcribing, analyzing, rendering, review-ready, failed, and canceled states;
- preview each returned hook;
- see its source episode/timecodes, hook type, score, rationale, cover frame, and platform-risk assessment;
- rename, reject, regenerate, or save a draft;
- save only explicitly approved drafts to `dramas/{slug}/social/hooks/` in R2.

### 4.2 Hook analysis

The worker pipeline is:

`R2 download → ffprobe → Faster-Whisper word timestamps → PySceneDetect boundaries → representative frames → multimodal story analysis → candidate scoring/deduplication → precise boundary selection → FFmpeg composition → QA`

Candidate scoring must include:

- first-three-second stopping power;
- conflict and emotional intensity;
- visual attraction and readable reactions;
- betrayal, humiliation/revenge, identity reveal, romantic/sexual tension, danger, and reversal signals;
- comprehension without prior context;
- a natural unanswered question or cliffhanger exit;
- dialogue/subtitle density and pacing;
- similarity to other candidates;
- platform safety and likely restriction risk.

The model must return grounded episode numbers and timestamps. Whisper word timestamps and scene boundaries constrain all final cuts; invented timestamps must be rejected.

### 4.3 Hook composition

Each output must:

- be 1080×1920 H.264/AAC MP4;
- begin and end on intentional word/scene boundaries;
- optionally use a 0.8–1.5 second cold open before returning to context;
- remove dead air and non-informational pauses without damaging performance cadence;
- remove episode logos, black frames, next-episode cards, ending stings, and accidental ending audio;
- use short audio fades or room-tone extension to prevent clicks and abrupt silence;
- preserve existing subtitles initially;
- optionally add a two-line safe-area hook title for 2–3 seconds;
- avoid repetitive template effects that reduce native-feed appearance.

### 4.4 First-frame cover rule

- Select a sharp, platform-safe frame with a readable face/reaction, intimate spatial tension, or immediately understandable action.
- Reject motion blur, obstructed faces, platform-unsafe nudity, subtitle collisions, and ambiguous frames.
- Encode the frame as the true first video frame and keyframe for a configurable 0.15–0.30 seconds.
- Do not add a separate thumbnail dependency.
- Audio begins with the narrative clip, not with an accidental duplicated syllable.
- Automated QA must extract and verify frame zero.

### 4.5 R2 assets and records

Persist approved assets with:

- drama ID/slug;
- source episode numbers;
- source and rendered time ranges;
- R2 object key and public URL;
- duration, dimensions, codecs, and size;
- hook type, title, score components, rationale, and risk level;
- cover source timestamp;
- transcript/model/prompt/ranking/render version;
- job and candidate IDs;
- review state, reviewer, and timestamps.

Temporary drafts must have retention and cleanup policies and must not appear in Publish Center until approved and saved.

## 5. Job architecture

Add durable entities equivalent to:

- `hook_generation_jobs`
- `hook_job_attempts`
- `hook_candidates`
- `hook_clips`

Required behavior:

- idempotency key based on drama, selected episodes, settings, and version;
- persisted progress and safe structured errors;
- lease/heartbeat for worker recovery;
- bounded retries with exponential backoff and jitter;
- cancellation and manual retry;
- no browser dependency after job acceptance;
- no synchronous FFmpeg/Whisper work inside a Vercel request;
- SSRF protection by resolving source URLs only from the selected drama’s stored R2 assets.

## 6. Publish Center

### 6.1 Asset selection

For the selected drama, the operator chooses exactly one:

- **Original:** a specific R2 episode;
- **Saved Hook:** a specific approved hook clip;
- **Manual Upload:** an explicitly uploaded finished video.

The selected video must be previewable and its immutable asset ID, URL, kind, and label must be saved on the publish package.

### 6.2 Provider interface

Implement a server-side provider boundary equivalent to:

```ts
interface PublishingProvider {
  listAccounts(): Promise<Account[]>;
  uploadMedia(asset: PublishAsset): Promise<RemoteMedia>;
  createPost(input: PublishPostInput): Promise<PublishResult>;
  getStatus(id: string): Promise<PublishStatus>;
}
```

Adapters:

1. `MetricoolCsvProvider` — preserve the current CSV workflow as fallback.
2. `UploadPostProvider` or `ZernioProvider` — first direct-publishing implementation, selected after a small credential/account feasibility spike.
3. `PostizProvider` — planned adapter for a separately deployed Postiz instance.

Do not embed Postiz or OpenPost code into this repository. If used, deploy separately and call its API.

### 6.3 Publishing controls

Support:

- per-platform account selection;
- shared caption with platform-specific overrides;
- immediate and scheduled publishing;
- TikTok privacy, duet, and stitch settings;
- Instagram Reels media type;
- YouTube title, privacy, tags, and optional playlist;
- upload progress and remote-media state;
- queued, uploading, scheduled, publishing, published, failed, and canceled status;
- provider request ID and platform post ID;
- idempotent retry that cannot duplicate a post;
- downloadable Metricool CSV when direct publishing is unavailable or fails.

## 7. Security and platform readiness

- Encrypt OAuth tokens and provider keys server-side; never return them to the browser.
- Require an explicit final confirmation for every real publish action.
- Validate R2 object ownership, media type, size, duration, and HTTPS URL.
- Separate provider account identity from display labels.
- Log safe provider error categories without tokens or private media URLs.
- Use official OAuth/API flows only.
- Before enabling a platform in production, record its app-review state, scopes, supported account types, content-publishing permissions, rate limits, and a successful draft/live test.
- “Adapter exists” must not be presented as “platform is production ready.”

## 8. Delivery phases

### Phase 3A — Architecture audit and stabilization

- Audit and preserve existing uncommitted Hook Studio/Publish Center work.
- Compare it with this PRD and identify unsafe synchronous rendering or incomplete schema changes.
- Add job/provider interfaces and database migrations.
- Keep Vizard and Metricool CSV operational.

### Phase 3B — Hook worker MVP

- Introduce the independent Python worker.
- Add Whisper, scene detection, grounded multimodal candidate selection, deduplication, FFmpeg render, first-frame cover, ending cleanup, and QA.
- Deliver Hook Studio job progress, review, and Save to R2.

### Phase 3C — Publish asset selection

- Add Original/Saved Hook/Manual Upload selection.
- Persist immutable asset identity on publish packages.
- Ensure only approved hooks appear.
- Preserve current caption and Metricool CSV generation.

### Phase 3D — Direct publishing spike and adapter

- Time-box a feasibility spike comparing Upload-Post/Zernio and a separate Postiz deployment.
- Verify TikTok, Instagram Reels, YouTube Shorts, and Facebook video publishing with the operator’s actual account types.
- Implement one provider behind the interface with mocked automated tests and manual sandbox/draft validation.
- Keep CSV fallback.

### Phase 3E — Performance learning loop

- Reconcile platform post IDs and status.
- Import available post metrics.
- Connect hook score/version to views, retention, Watch Full CTR, conversions, and revenue.
- Do not train or claim a learned ranking model until data sufficiency and evaluation criteria are defined.

## 9. Acceptance criteria

- Selecting a drama and its first five episodes creates a durable job that survives browser closure.
- The worker returns no more than two non-duplicate hooks and may return fewer below threshold.
- Every hook reports grounded source episode/timecodes and a selection rationale.
- Frame zero is the intended cover, is a keyframe, and remains visible long enough for uploader thumbnail extraction.
- Rendered files contain no accidental ending sting, end card, or abrupt audio click.
- A reviewed hook is absent from R2 and Publish Center until Save to R2 succeeds.
- Publish Center can select a specific original episode, saved hook, or manual upload.
- Publish packages retain immutable asset identity, kind, provider, request ID, and status.
- Direct publishing is idempotent and requires explicit confirmation.
- Failure can be retried safely or exported through Metricool CSV.
- Tests never publish to a live platform.

## 10. Required test coverage

- hook candidate scoring thresholds and deduplication;
- timestamp grounding and boundary snapping;
- first-frame insertion and frame-zero extraction;
- ending video/audio cleanup;
- codec, aspect ratio, duration, and audio-sync QA;
- job idempotency, lease expiry, retries, cancellation, and recovery;
- R2 path/ownership validation and save transition;
- Publish Center asset filtering and immutable selection;
- provider adapters with mock upload/create/status responses;
- duplicate-publish prevention and CSV fallback.

## 11. Codex implementation instructions

Codex must begin by reading this PRD, inspecting the current worktree, and producing an evidence-based implementation plan before additional code changes. The plan must:

1. identify any partial Hook Studio implementation already present and decide what to keep, replace, or migrate;
2. separate Next.js control-plane work from the Python video worker;
3. list schema migrations and deployment requirements;
4. identify license/attribution obligations;
5. stage delivery in the Phase 3A–3E order;
6. define verification for each stage;
7. avoid live publishing until the operator explicitly authorizes a sandbox or draft test.

After presenting the plan, Codex should implement the next safe, testable stage without reviving the superseded Phase 2 roadmap.
