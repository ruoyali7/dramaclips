# DramaClips

DramaClips is a production-oriented short-drama distribution and attribution platform. It connects authorized source media, publishing operations, public preview pages, referral routing, and performance signals in one inspectable workflow. Built-in Generate Hook exists as paused optional work and is not part of the active product plan.

> A live software product built and operated for short-drama affiliate promotion.

[Live product](https://dramaclips.vercel.app/) · [Compliance guardrails](docs/rs-boost-compliance.md)

## Why it exists

Short-form content work is often scattered across video files, clipping tools, cloud storage, publishing tools, affiliate links, and analytics. DramaClips makes those handoffs explicit and durable so creative judgment is preserved while operational work becomes repeatable.

## Workflow

```text
Source drama → Upload or ingest authorized assets → Review publishing package
      → Publish to social platforms → Public preview and referral flow
      → Measure visits, code copies, and redirect outcomes → Iterate
```

1. Create a drama record and connect its source metadata and episodes.
2. Upload source videos directly to Cloudflare R2 using short-lived signed URLs.
3. Use an original episode, Vizard output, manual upload, or previously saved hook as the publishing asset.
4. Review platform copy, accounts, timing, and the immutable selected asset in Publish Center.
5. Publish across the configured social channels with explicit confirmation and recoverable status.
6. Route viewers through the public preview experience and record meaningful funnel events.

## Architecture

| Layer | Responsibility |
| --- | --- |
| Next.js + TypeScript | Operator UI, public catalog, API routes, preview and redirect flows |
| Supabase / PostgreSQL | Drama metadata, jobs, leases, review records, publishing state, and tracking events |
| Cloudflare R2 | Durable source episodes, generated drafts, and approved media assets |
| Railway worker | Active Vizard and publishing jobs; paused optional hook-generation code |
| Provider integrations | Replaceable boundaries for clipping, social publishing, and affiliate destinations |

Long-running media work is asynchronous. PostgreSQL state, worker leases, progress updates, idempotency, and retry handling keep operations visible and recoverable outside the request cycle.

## Attribution boundary

DramaClips preserves context across drama, clip, platform, campaign, and session behavior. It can measure first-party events such as preview visits, referral-code copies, and redirect outcomes. It does not claim provider-supplied purchase, revenue, or conversion data that the system cannot verify.

## Implementation details

- Browser-to-R2 uploads keep large video files out of the application request body.
- Approved hooks are explicitly saved before they become publishable assets, keeping creative review separate from automated generation.
- Uploading, rendering, and publishing use visible asynchronous states with recoverable progress.
- Vizard remains the active optional third-party clipping path. The in-house Generate Hook path is paused and must not be extended or enabled without explicit approval.

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
- `/admin/hooks` — paused legacy Generate Hook interface; not part of the active product plan
- `/admin/vizard` — optional third-party clipping from existing R2 episodes
- `/admin/publish` — choose a specific original or hook asset for distribution
- `/admin/tracking` — attributed social link builder
- `/admin/settings` — repository status

## Data and security

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, drama bundles are stored in Supabase. CPS links are AES-256-GCM encrypted before storage and decrypted only in the server redirect. R2 and Vizard secrets remain server-only; the browser receives only expiring R2 upload signatures and public media URLs.

The paused Hook worker requires `ffmpeg` and `ffprobe` only if that optional capability is explicitly re-enabled. Video analysis and rendering must run on Railway or another approved long-running worker, never inside a Vercel request.

## Compliance

All RS Boost ingestion, media use, browser automation, and publishing changes must follow the mandatory [RS Boost compliance guardrails](docs/rs-boost-compliance.md). If a proposed use is ambiguous—especially scraping, authenticated automation, standalone media use, or third-party access—do not deploy it without written authorization from RS Boost.
