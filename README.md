# DramaClips

DramaClips is a mobile short-drama preview funnel with one protected admin workspace for content onboarding, Cloudflare R2 uploads, Vizard social clipping, tracking links, and ReelShort CPS redirects.

## Unified workflow

1. Open `/admin/dramas/new`, enter the RS drama metadata, and select the authorized preview episode files.
2. The browser requests short-lived signed upload URLs. Videos go directly to R2, never through the Vercel function body.
3. Save and publish the drama. It immediately becomes available on the public catalog and in `/admin/vizard`.
4. In Hook Studio, select a drama and the first one to five episodes. The server creates up to two 9:16 hooks and prepends the strongest frame for 0.1 seconds as an uploader-compatible cover. Review each draft and explicitly save approved clips to R2.
5. In Publish Center, choose the exact original episode, saved hook, or manual upload to distribute.
6. Vizard Studio remains available as an optional third-party batch-clipping path.

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
