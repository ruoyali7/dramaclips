# Phase 3 Publishing Production QA and Sign-off

This is the evidence table for one authorized production validation. Its purpose is to prove that the deployed publishing workflow works outside local tests. Built-in Generate Hook is paused and is not part of this sign-off.

## Run metadata

- Run date:
- Operator:
- Source asset ID/type:
- Publish package ID:
- Vercel deployment:
- Railway worker deployment:
- Supabase migration head:
- Vercel usage baseline window:

## Publishing acceptance

| Area | Expected result | Evidence | Status |
| --- | --- | --- | --- |
| Asset selection | Authorized R2/Vizard/upload asset is previewable and stored immutably | asset and package IDs | pending |
| Copy and accounts | Four platform captions and selected accounts survive refresh | package ID | pending |
| Confirmation | No provider action begins before explicit confirmation | package history | pending |
| Scheduling | Future time persists and is executed by Railway | package ID and scheduled time | pending |
| Reconciliation | Unknown outcome is reconciled before retry | platform attempt and post ID | pending |
| Cancellation | Queued or active operation can be canceled safely | package status history | pending |
| Duplicate prevention | Confirmed successful platforms are not republished | attempt history | pending |
| CSV fallback | Metricool CSV remains downloadable | CSV export | pending |
| Runtime usage | Requests, Function Duration, Fluid Active CPU, errors, and data transfer are compared with baseline | Vercel Usage screenshots/values | pending |

## Platform evidence

Record one row per authorized account. A missing credential, scope, or provider capability is `blocked`, not `passed`.

| Platform | Account type/scopes | Validation or publish result | Provider request ID | Post ID | Status |
| --- | --- | --- | --- | --- | --- |
| TikTok |  |  |  |  | pending |
| Instagram Reels |  |  |  |  | pending |
| YouTube Shorts |  |  |  |  | pending |
| Facebook video |  |  |  |  | pending |

## Sign-off rule

Every applicable row must contain production evidence. Do not retry an `outcome_unknown` platform until reconciliation confirms failure. Local tests, a Git push, or a Ready Vercel deployment alone do not complete this table.
