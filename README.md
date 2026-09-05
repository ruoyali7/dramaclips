# DramaClips

DramaClips is a production-oriented short-drama distribution and attribution platform. It connects source media, AI-assisted hook generation, human review, publishing operations, public preview pages, referral routing, and performance signals in one inspectable workflow.

> A live software product built and operated for short-drama affiliate promotion.

[Live product](https://dramaclips.vercel.app/) · [Compliance guardrails](docs/rs-boost-compliance.md)

## Why it exists

Short-form content work is often scattered across video files, clipping tools, cloud storage, publishing tools, affiliate links, and analytics. DramaClips makes those handoffs explicit and durable so creative judgment is preserved while operational work becomes repeatable.

## Workflow

```text
Source drama → Upload episodes → Generate hooks → Review and approve
      → Publish to social platforms → Public preview and referral flow
      → Measure visits, code copies, and redirect outcomes → Iterate
```

1. Create a drama record and connect its source metadata and episodes.
2. Upload source videos directly to Cloudflare R2 using short-lived signed URLs.
3. Generate vertical hook candidates with transcript-led analysis and FFmpeg rendering.
4. Review candidates, inspect their evidence, and explicitly save approved assets.
5. Select an original episode or approved hook in Publish Center and prepare delivery.
6. Publish across the configured social channels with platform-specific copy and links.
7. Route viewers through the public preview experience and record meaningful funnel events.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Next.js + TypeScript | Operator UI, public catalog, API routes, preview and redirect flows |
| Supabase / PostgreSQL | Drama metadata, jobs, leases, review records, publishing state, and tracking events |
| Cloudflare R2 | Durable source episodes, generated drafts, and approved media assets |
| Railway worker | Long-running transcription, analysis, ranking, rendering, upload, and publishing jobs |
| Provider integrations | Replaceable boundaries for clipping, social publishing, and affiliate destinations |

Long-running media work is asynchronous. PostgreSQL state, worker leases, progress updates, idempotency, and retry handling keep operations visible and recoverable outside the request cycle.

## Attribution boundary

DramaClips preserves context across drama, clip, platform, campaign, and session behavior. It can measure first-party events such as preview visits, referral-code copies, and redirect outcomes. It does not claim provider-supplied purchase, revenue, or conversion data that the system cannot verify.

## Implementation details

- Browser-to-R2 uploads keep large video files out of the application request body.
- Approved hooks are explicitly saved before they become publishable assets, keeping creative review separate from automated generation.
- Uploading, rendering, and publishing use visible asynchronous states with recoverable progress.
- Vizard remains an optional third-party batch-clipping path alongside the in-house Hook Studio.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/admin/login`. Required production-only secrets are documented in `.env.example`. R2 must allow browser `PUT` requests from the local and production origins through its bucket CORS policy.

### RS Boost Chrome import

Install the private unpacked extension from `chrome-extension/dramaclips-rs-importer` in the Chrome profile signed in to RS Boost. Add Drama will then accept one RS Boost detail link, open that signed-in page, and autofill the visible promotion metadata for review. See the extension README for the one-time installation steps.

## Main routes

- `/` — public drama catalog and code search
- `/watch/[slug]` — preview episodes and Watch Full CTA
- `/admin/dramas` — content and publishing queue
- `/admin/dramas/new` — drama metadata plus direct-to-R2 batch upload
- `/admin/hooks` — generate, review, and save in-house hook edits
- `/admin/vizard` — optional third-party clipping from existing R2 episodes
- `/admin/publish` — choose a specific original or hook asset for distribution
- `/admin/tracking` — attributed social link builder
- `/admin/settings` — repository status

## Data and security

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, drama bundles are stored in Supabase. CPS links are AES-256-GCM encrypted before storage and decrypted only in the server redirect. R2 and Vizard secrets remain server-only; the browser receives only expiring R2 upload signatures and public media URLs.

Hook rendering requires `ffmpeg` and `ffprobe` on the server. Run `202608140001_hook_clips.sql` before enabling the production UI. Because rendering downloads and transcodes source episodes, deploy the Next.js server on a long-running Node/container runtime rather than a short-lived serverless function.

## Compliance

All RS Boost ingestion, media use, browser automation, and publishing changes must follow the mandatory [RS Boost compliance guardrails](docs/rs-boost-compliance.md). If a proposed use is ambiguous—especially scraping, authenticated automation, standalone media use, or third-party access—do not deploy it without written authorization from RS Boost.
