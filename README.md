# DramaClips

DramaClips is a mobile short-drama preview funnel with one protected admin workspace for content onboarding, Cloudflare R2 uploads, Vizard social clipping, tracking links, and ReelShort CPS redirects.

## Unified workflow

1. Open `/admin/dramas/new`, enter the RS drama metadata, and select the authorized preview episode files.
2. The browser requests short-lived signed upload URLs. Videos go directly to R2, never through the Vercel function body.
3. Save and publish the drama. It immediately becomes available on the public catalog and in `/admin/vizard`.
4. In Vizard Studio, select the drama and episodes, choose clip settings, and submit them from their existing R2 URLs. The UI observes Vizard's 30-second batch interval.
5. Generate a social-specific direct link in `/admin/tracking`. Visitors land on the selected drama; Watch Full redirects through the protected CPS route.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000/admin/login`. Required production-only secrets are documented in `.env.example`. R2 must allow browser `PUT` requests from the local and production origins through its bucket CORS policy.

## Main routes

- `/` — public drama catalog and code search
- `/watch/[slug]` — preview episodes and Watch Full CTA
- `/admin/dramas` — content and publishing queue
- `/admin/dramas/new` — drama metadata plus direct-to-R2 batch upload
- `/admin/vizard` — social clipping from existing R2 episodes
- `/admin/tracking` — attributed social link builder
- `/admin/settings` — repository status

## Data and security

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, drama bundles are stored in Supabase. CPS links are AES-256-GCM encrypted before storage and decrypted only in the server redirect. R2 and Vizard secrets remain server-only; the browser receives only expiring R2 upload signatures and public media URLs.
