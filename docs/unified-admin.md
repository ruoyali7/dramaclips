# Unified admin architecture

DramaClips has one private admin workspace under `/admin`. Dramas, assets, Vizard, Publish Center, Opportunity, tracking, Analytics, and settings are sections of the same admin; no second admin is planned.

## Content pipeline

`Authorized drama metadata + source media` → `signed browser upload or remote ingestion` → `R2 assets` → `operator review` → `published catalog/preview`

Large browser uploads use signed R2 PUT URLs and do not pass through Vercel request bodies.

## Publishing pipeline

`Published drama + R2/Vizard/manual asset` → `Publish Center` → `copy/accounts/schedule review` → `explicit confirmation` → `Supabase queue` → `Railway publish worker` → `Yixiaoer` → `status/reconciliation`

Metricool CSV remains the fallback. Vizard is optional and uses durable server-side submission state; a Vizard outage must not block catalog publishing or playback.

Built-in Generate Hook is paused. Existing saved hooks may still be selected as publishing assets, but no new Hook generation work belongs to the active product plan.

## Runtime ownership

- Vercel: admin/public pages, short APIs, validation, signed-upload creation, and worker wake-up.
- Supabase: durable metadata, assets, queues, attempts, publishing state, and analytics events.
- Railway: Vizard and Yixiaoer long-running workers.
- R2: durable video and image assets.

## Operational requirements

- R2 bucket CORS must allow `PUT` from `http://localhost:3000` and `https://dramaclips.vercel.app`.
- R2 public media should use a stable public/custom domain.
- `R2_*`, `VIZARD_API_KEY`, Supabase service role, encryption, admin session, and provider values remain server-side secrets.
- The current admin password is suitable only for a private single-operator workspace. Replace it with role-aware authentication before adding staff accounts.
- New designs must estimate and verify Vercel Requests, Function Duration, Fluid Active CPU, errors, and data transfer.
