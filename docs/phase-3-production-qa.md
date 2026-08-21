# Phase 3 Production QA and Sign-off

Use this checklist for a non-public draft or validation run before enabling live publishing.

## Run metadata

- Run date:
- Operator:
- Drama slug:
- Source episodes:
- Vercel deployment:
- Railway worker deployment:
- Supabase migration head:

## End-to-end acceptance

| Area | Expected result | Evidence | Status |
| --- | --- | --- | --- |
| Drama/source selection | Published drama exposes the first 1–5 R2 episodes | drama slug and episode numbers | pending |
| Hook direction | Original direction survives refresh and job restoration | job ID and stored direction | pending |
| Async job | Job reaches review-ready or honest no-result without browser open | job status history | pending |
| Hook grounding | Candidate includes source episode, timestamps, rationale, and risk | candidate ID | pending |
| Frame zero | Cover is the actual first frame and remains visible for extraction | extracted frame / ffprobe | pending |
| Save to R2 | Only approved hook becomes a saved clip | R2 object key and clip ID | pending |
| Publish Center | Original and saved hook can be selected as immutable assets | package ID and asset kind | pending |
| Yixiaoer validation | Draft/validate completes with remote media state | request ID | pending |
| Scheduling | Future time is snapped to ten-minute boundary and persists | package ID and scheduled time | pending |
| Reconciliation | Unknown outcome is reconciled before retry | platform attempt and post ID | pending |
| Cancellation | Queued or active operation can be canceled safely | package status history | pending |
| CSV fallback | Metricool CSV remains downloadable when direct publishing is unavailable | CSV export | pending |

## Platform evidence

Record one row per authorized account and keep live publishing disabled unless the operator explicitly approves it.

| Platform | Account type/scopes | Draft or validation result | Provider request ID | Post ID | Status |
| --- | --- | --- | --- | --- | --- |
| TikTok |  |  |  |  | pending |
| Instagram Reels |  |  |  |  | pending |
| YouTube Shorts |  |  |  |  | pending |
| Facebook video |  |  |  |  | pending |

## Sign-off rule

Phase 3 production sign-off requires every applicable row above to have evidence. Missing provider authorization is recorded as `blocked: credentials/scopes`, not as a passing result. Do not retry an `outcome_unknown` publish until provider reconciliation confirms failure.

## Phase 3E handoff

After sign-off, collect platform metrics keyed by `drama`, `hook_clip_id`, `pipeline_version`, `provider`, `provider_post_id`, and publish timestamp. Begin with views, retention, completion rate, profile/CTA clicks, conversions, and revenue; do not change ranking weights until there is enough data for a defined comparison.
