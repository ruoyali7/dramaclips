# DramaClips Phase 2 PRD

> **Superseded on 2026-08-14.** Do not use this document as the active implementation plan. The current product direction is defined in [`phase-3-hook-production-prd.md`](./phase-3-hook-production-prd.md). Phase 2 remains only as historical context.

**Working title:** Reliable Content Pipeline & Growth Loop  
**Status:** Draft for discussion  
**Phase 1 status:** Core vertical slice deployed  
**Primary objective:** Turn the deployed content workflow into a reliable, recoverable, and measurable production system without introducing infrastructure that has no demonstrated need.

## 1. Background

Phase 1 delivers the core vertical slice:

`Drama onboarding → R2 upload → publish → Vizard submission → publish package → tracking link → preview funnel → CPS redirect`

The current product is more than an API wrapper, but several steps are still browser-driven or manually connected. Vizard submission state is held in the browser, generated assets are not automatically collected, publishing status is not reconciled, conversions are not ingested, and parts of the admin workspace still contain demo or placeholder content.

Phase 2 will make the existing workflow dependable and close the measurement loop before investing in a fully internal video-analysis stack or machine-learned ranking.

## 2. Product principles

1. **Reliability before scale.** A task must survive refreshes, disconnects, deploys, and worker crashes before the system optimizes throughput.
2. **Measure before modeling.** Ranking work begins with transparent heuristics. Training or learning-to-rank requires sufficient real outcome data.
3. **Modular monolith first.** Keep the Next.js application and Postgres domain model cohesive. Add an independent worker where long-running work requires it; do not split into microservices without operational evidence.
4. **Build versus buy remains reversible.** Vizard remains supported while an internal FFmpeg/Whisper provider can be introduced later behind a common interface.
5. **No fabricated production metrics.** Admin dashboards must show real data, an explicit empty state, or a clearly labeled demo mode.
6. **Every automated action is traceable.** Operators must be able to determine what ran, why it failed, whether it retried, and what output it produced.

## 3. Goals

- Persist every long-running content task and its state.
- Make task execution idempotent, retryable, observable, and recoverable.
- Collect Vizard results and move approved clip assets into publishing without manual re-upload where the provider permits it.
- Connect source drama, episode, generated clip, publish package, platform post, tracked visit, conversion, and revenue.
- Replace demo and placeholder operational surfaces with real data or honest empty states.
- Produce measured concurrency and reliability results suitable for production decisions and engineering case-study discussion.

## 4. Non-goals

- Replacing Vizard completely during the first Phase 2 milestone.
- Building a custom video editor.
- Training a recommendation or ranking model before sufficient outcome data exists.
- Adopting Kubernetes or decomposing the product into many microservices.
- Supporting multiple organizations, billing, or a public self-service SaaS product.
- Guaranteeing direct publishing to every social platform when provider access is unavailable; export-based workflows may remain valid fallbacks.

## 5. Success metrics

Initial targets must be validated against real production traffic during implementation.

### Reliability

- 100% of server-side processing jobs have a persisted state and attempt history.
- Refreshing or closing the admin browser does not stop an accepted job.
- Duplicate submissions with the same idempotency key do not create duplicate provider work.
- Retryable provider failures are retried automatically up to the configured limit.
- Stuck jobs are detected and recoverable without direct database edits.

### Operations

- An operator can see queued, running, succeeded, failed, canceled, and timed-out jobs.
- Every failed job exposes a safe error category, attempt count, and next action.
- Vizard outputs that are available through its API are associated with their source episode and job.
- Production dashboards contain no unlabeled fabricated data.

### Measurement

- Each published clip can be traced back to its source drama and episode.
- Each tracked visit can be segmented by clip, platform/source, account, campaign, and variant where supplied.
- Imported conversions are idempotent by provider event ID.
- The dashboard can report clip-level Watch Full CTR and, when conversion data exists, conversions, revenue, and EPC.

### Performance

- A reproducible benchmark compares sequential processing with bounded concurrency.
- Concurrency limits are configurable per provider.
- Rate-limit responses respect provider guidance where available and otherwise use exponential backoff with jitter.

## 6. Milestones and requirements

## M0 — Production hardening

**Why now:** Reliability work should not be built on top of misleading dashboards or unfinished production configuration.

### Requirements

- Replace hard-coded admin overview metrics with live analytics or explicit empty/setup states.
- Remove, hide, or clearly label placeholder Destinations, Landings, and Conversions screens until their real workflows exist.
- Generate the sitemap from published repository data rather than demo-only data.
- Run and document a production smoke test covering:
  - admin authentication;
  - local upload and remote transfer to R2;
  - drama save and publish;
  - Vizard submission;
  - publish-package creation and Metricool CSV export;
  - short-link landing, preview playback, and CPS redirect;
  - analytics event persistence.
- Add production error reporting for failed API routes and background jobs without logging secrets, destination URLs, or PII.
- Define backup, secret rotation, and incident procedures in the runbook.
- Decide whether single-operator password authentication remains acceptable or Supabase Auth is required in this phase.

### Acceptance criteria

- No production admin page presents fabricated values as real data.
- Newly published dramas appear in the sitemap.
- The smoke-test checklist passes on the deployed environment.
- Known setup failures produce actionable operator messages.

### Decisions to discuss

- **D01:** Keep single-operator authentication for Phase 2, or migrate immediately to Supabase Auth?
- **D02:** Hide unfinished admin modules, or implement their minimum viable versions in M0?
- **D03:** Which monitoring service, if any, should receive production errors?

## M1 — Persistent job system

**Why now:** The current Vizard queue and rate-limit wait live in browser memory. Work can be lost when the page closes and there is no durable attempt history.

### Core entities

- `jobs`: task type, state, priority, idempotency key, input reference, output reference, scheduled time, lease information, timestamps.
- `job_attempts`: attempt number, worker identity, start/end time, outcome, safe error code, retry time.
- `clip_assets`: source drama/episode, provider, provider project ID, media URL/object key, duration, aspect ratio, review state, metadata.

### State model

`queued → leased → running → succeeded`

Terminal alternatives: `failed`, `canceled`, `timed_out`.

Retryable failures return to `queued` with a future `available_at`. A lease expiry makes abandoned work recoverable. State transitions must be validated server-side.

### Requirements

- Persist accepted jobs before returning success to the browser.
- Generate or accept an idempotency key based on task type and stable input/settings.
- Prevent concurrent execution of the same job.
- Lease work for a bounded interval and renew the lease during valid long-running work.
- Classify errors as retryable or terminal.
- Support exponential backoff with jitter and a maximum attempt count.
- Support timeout, cancellation request, manual retry, and stuck-job recovery.
- Record safe structured events for important state transitions.
- Provide an admin job list and job-detail view.

### Architecture constraint

Vercel request handlers must not be treated as permanent workers. Long-running execution should use an independent worker or an appropriate durable-job provider. Postgres remains the system of record unless a measured requirement justifies Redis.

### Acceptance criteria

- A submitted task continues when the browser closes.
- Repeating the same submission does not create duplicate provider work.
- A worker terminated during execution leaves a recoverable job after lease expiry.
- Retryable 429/5xx failures follow the configured backoff policy.
- Operators can retry or cancel eligible jobs from the admin workspace.
- Automated tests cover allowed and forbidden state transitions, idempotency, lease expiry, retry limits, and cancellation.

### Decisions to discuss

- **D04:** Postgres-backed queue plus independent worker, or a managed durable-job platform?
- **D05:** Where should the worker be deployed?
- **D06:** Which task types enter the system first: Vizard only, or Vizard plus remote R2 transfers?
- **D07:** Required retry limits, timeouts, and retention periods?

## M2 — Vizard result ingestion and clip asset workflow

**Why now:** Submission alone does not complete the production pipeline. Provider outputs need to become durable, reviewable assets.

### Requirements

- Submit Vizard work through the persistent job system.
- Store the provider project ID and sanitized provider response metadata.
- Discover completion through webhook where supported, otherwise scheduled polling.
- Download or reference generated clips according to provider capabilities and terms.
- Copy final assets to controlled R2 storage when permitted and useful.
- Associate every clip with source drama, episode, settings, provider job, and timestamps.
- Provide review states: `unreviewed`, `approved`, `rejected`.
- Allow an approved clip to create a publish package without manual URL copying or re-upload.
- Keep Vizard outage isolated from public playback and drama publishing.

### Acceptance criteria

- A Vizard submission can progress from queued to completed without an open browser.
- Returned clips appear under the correct drama and episode.
- Approved clips can enter Publish Center in one operator action.
- Provider failures, missing outputs, and expired URLs have defined recovery paths.

### Decisions to discuss

- **D08:** Automatic R2 copy versus retaining provider URLs?
- **D09:** Require manual clip approval, or allow policy-based auto-approval?
- **D10:** Polling interval, maximum processing duration, and provider-cost safeguards?

## M3 — Publishing status and growth data loop

**Why now:** Content generation has limited business value if published performance and conversion outcomes cannot be attributed to the generated clip.

### Canonical relationship

`drama → episode → clip_asset → publish_package → platform_post → short_link → session/click → conversion`

### Requirements

- Store platform post IDs, platform/account identity, scheduled time, published time, and publish status.
- Preserve CSV/manual publishing as a fallback when direct API access is unavailable.
- Import post metrics through supported APIs or structured CSV ingestion.
- Ingest conversion events with a unique provider event ID and idempotent upsert behavior.
- Support exact click attribution when a click identifier is available and clearly label provider, aggregate, or manual attribution otherwise.
- Report at minimum:
  - visits and unique sessions;
  - episode starts and completions;
  - Watch Full CTR;
  - conversions and revenue where available;
  - EPC and conversion rate;
  - breakdown by drama, clip, source/platform, account, campaign, and variant.
- Expose missing attribution and data freshness so metrics are not presented with false precision.

### Acceptance criteria

- An operator can trace a reported conversion to its attribution method and, where possible, to a clip.
- Re-importing the same conversion or metrics file does not duplicate results.
- Dashboard totals reconcile with imported source totals within documented attribution limits.
- Empty and stale data are clearly identified.

### Decisions to discuss

- **D11:** Which conversion source and export format will be integrated first?
- **D12:** Which publishing/analytics provider is the initial source of post metrics?
- **D13:** What is the canonical definition of a conversion and revenue for this project?
- **D14:** Required data-retention and privacy rules?

## M4 — Bounded concurrency and benchmarking

**Why now:** Concurrency should be introduced with provider limits and measured workload, not as an arbitrary worker count.

### Requirements

- Configure global and per-provider concurrency.
- Respect `Retry-After` where supplied.
- Otherwise use exponential backoff with jitter.
- Prevent one provider or drama from starving all other queued work.
- Capture job latency, queue wait time, attempt count, throughput, and failure rate.
- Provide a reproducible benchmark for sequential and bounded-concurrency modes.
- Document the selected concurrency setting and the evidence behind it.

### Acceptance criteria

- Benchmark results include workload description, environment, N values, throughput, latency, and error rate.
- Increasing concurrency beyond provider or system capacity does not create an uncontrolled retry storm.
- A batch can partially succeed and retry only failed items.

### Decisions to discuss

- **D15:** What real batch size should define the benchmark: 20, 100, or 500 videos?
- **D16:** Which limits are imposed by Vizard, R2, deployment compute, and local bandwidth?
- **D17:** Is fairness scheduling needed, or is FIFO sufficient initially?

## M5 — Internal clipping provider (conditional)

**Entry condition:** M1–M3 are operating reliably, or Vizard cost/quality/control creates a demonstrated product constraint.

### Proposed pipeline

`media probe → transcription → sentence/scene candidates → heuristic scoring → timestamp selection → FFmpeg render → subtitle render → clip asset`

### Requirements

- Define a provider interface shared by Vizard and the internal pipeline.
- Use FFmpeg/ffprobe for media inspection and deterministic clipping.
- Use Whisper or an equivalent speech-to-text engine with timestamped output.
- Store transcript segments and candidate timestamps separately from rendered assets.
- Score candidates with explainable inputs such as hook strength, conflict, emotion, completeness, subtitle density, and duration fit.
- Track runtime, cost, failure rate, and operator acceptance rate for both providers.
- Do not describe heuristic scores as a trained recommendation model.

### Acceptance criteria

- The same source episode can be processed by either provider through one job interface.
- Internal outputs are reproducible from stored settings and model/version metadata.
- A comparison report covers quality, cost, latency, and acceptance rate.

### Decisions to discuss

- **D18:** What concrete Vizard limitation justifies building the internal provider?
- **D19:** Local/GPU worker versus hosted transcription API?
- **D20:** Which languages and subtitle formats are required first?

## M6 — Clip ranking and experimentation (conditional)

**Entry condition:** Clip-level outcome data is sufficiently complete to evaluate ranking quality.

### Evolution

1. **Heuristic ranking:** transparent weighted scores.
2. **Outcome-calibrated ranking:** weights adjusted using retention, Watch Full CTR, conversions, and revenue.
3. **Learned ranking or bandit:** considered only after data volume, exploration policy, and evaluation methodology are adequate.

### Requirements

- Version every ranking policy and preserve component scores.
- Keep selection explainable to the operator.
- Prevent leakage by evaluating on later time windows or held-out dramas.
- Separate platform engagement objectives from conversion/revenue objectives.
- Support manual overrides and record whether the operator accepted the recommendation.

### Acceptance criteria

- Every ranked result shows its policy version and score explanation.
- Offline evaluation compares the ranking against a simple baseline.
- Any claimed improvement includes sample size, time window, and metric definition.

### Decisions to discuss

- **D21:** Primary objective: retention, Watch Full CTR, conversions, or revenue?
- **D22:** Minimum data threshold before learned ranking is considered?
- **D23:** How much exploration is acceptable in production?

## 7. Cross-cutting requirements

### Security and privacy

- Secrets remain server-side.
- Logs never include CPS destination URLs, tokens, raw IP addresses, or unnecessary provider payloads.
- Job inputs reference protected records or object keys instead of duplicating secrets.
- Admin mutations require authentication and appropriate CSRF/session protections.
- Uploaded content must be authorized for processing and distribution.

### Observability

- Use structured logs with job ID, attempt ID, task type, state, duration, and safe error code.
- Track queue depth, oldest queued age, running count, success/failure rate, retry count, and p95 duration.
- Alert on sustained queue age, repeated provider failure, stuck jobs, and conversion-import failures.
- Public redirects and playback remain available when analytics or worker systems are degraded.

### Data integrity

- Use database constraints for state values and unique external IDs.
- Store timestamps in UTC; convert only for display/export.
- Define deletion behavior for dramas, source episodes, jobs, clips, posts, events, and conversions.
- Schema migrations must be reversible where practical and documented where not.

### Testing

- Unit tests for state transitions, backoff, idempotency keys, attribution, and ranking components.
- Integration tests for repository behavior and provider adapters with mocked provider responses.
- End-to-end smoke coverage for the deployed critical path.
- Failure-injection tests for timeouts, 429, provider 5xx, expired leases, duplicate webhooks/imports, and partial batches.

## 8. Explicitly deferred infrastructure

The following are not selected by default:

- Redis, unless Postgres queue contention or latency is measured as inadequate.
- Celery or BullMQ, unless the chosen worker language/runtime and hosting model make them the clearest operational choice.
- Multiple independently deployed domain services.
- Kubernetes.
- A trained recommendation system without sufficient labeled outcomes.

Deferral does not prohibit later adoption; it requires a recorded constraint, benchmark, or operational need.

## 9. Delivery order

Recommended sequence:

1. M0 — Production hardening
2. M1 — Persistent job system
3. M2 — Vizard result ingestion and clip assets
4. M3 — Publishing status and growth data loop
5. M4 — Concurrency and benchmark
6. M5 — Internal clipping provider, if justified
7. M6 — Ranking and experiments, after data readiness

M3 schema design should begin alongside M1 so identifiers and lineage are not retrofitted later. Full M3 UI can follow M2.

## 10. Discussion protocol and decision log

Each decision will be discussed separately. A decision is complete only when this document records:

- selected option;
- reason and evidence;
- rejected alternatives and trade-offs;
- scope or acceptance-criteria changes;
- follow-up implementation issue, if any.

| ID | Topic | Status | Decision |
|---|---|---|---|
| D01 | Authentication timing | Open | — |
| D02 | Placeholder admin modules | Open | — |
| D03 | Monitoring service | Open | — |
| D04 | Job-system foundation | Open | — |
| D05 | Worker deployment | Open | — |
| D06 | Initial queued task types | Open | — |
| D07 | Retry, timeout, retention | Open | — |
| D08 | Vizard asset storage | Open | — |
| D09 | Clip approval policy | Open | — |
| D10 | Vizard polling and safeguards | Open | — |
| D11 | First conversion source | Open | — |
| D12 | First platform-metrics source | Open | — |
| D13 | Conversion and revenue definitions | Open | — |
| D14 | Retention and privacy | Open | — |
| D15 | Benchmark batch size | Open | — |
| D16 | Provider/system limits | Open | — |
| D17 | Queue fairness | Open | — |
| D18 | Internal-provider justification | Open | — |
| D19 | Transcription compute | Open | — |
| D20 | Initial language/subtitle scope | Open | — |
| D21 | Ranking objective | Open | — |
| D22 | Learned-ranking data threshold | Open | — |
| D23 | Production exploration policy | Open | — |

### Recommended discussion order

Discuss dependencies before implementation details:

1. **D02** — Decide whether unfinished admin surfaces are hidden or completed.
2. **D01** — Confirm the authentication boundary and number of operators.
3. **D03** — Select the minimum production monitoring approach.
4. **D04** — Choose the job-system foundation.
5. **D05–D07** — Define worker hosting and execution semantics.
6. **D08–D10** — Define the complete Vizard asset lifecycle.
7. **D11–D14** — Define the business data loop and source of truth.
8. **D15–D17** — Benchmark and tune concurrency.
9. **D18–D20** — Decide whether internal clipping is justified.
10. **D21–D23** — Define ranking only after data readiness is proven.

## 11. Phase 2 completion definition

Phase 2 is complete when M0–M4 pass their acceptance criteria in production. M5 and M6 are conditional extensions and do not block Phase 2 completion unless separately promoted into committed scope.

At completion, DramaClips should be credibly described as a reliable content-production and attribution platform: it durably orchestrates video jobs, recovers from partial failures, manages generated assets, controls publishing handoff, and connects clip-level activity to measurable outcomes.
