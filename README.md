# DramaClips

Mobile-first short-drama affiliate discovery and redirect platform, built from the v1 PRD. The repository currently contains a polished public experience, a representative admin workspace, secure redirect-domain logic, Supabase schema/RLS, and unit tests.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Useful routes:

- `/` — public discovery and exact-code search
- `/l/featured?s=tiktok&a=account-us-01&c=summer-romance&cl=clip-0042` — attributed landing
- `/d/the-billionaires-vow` — drama detail
- `/admin` — dashboard prototype
- `/go/billionaires-vow` — server redirect (uses placeholder `.test` destination)

## Production setup

1. Create separate Supabase projects for preview and production.
2. Apply `supabase/migrations/202608100001_initial.sql` and `supabase/migrations/202608110001_drama_bundles.sql`, then use `supabase/seed.sql` only in local/test environments.
3. Replace the demo repository in `lib/demo-data.ts` with a server-only Supabase repository. Decrypt CPS destinations only inside the redirect handler.
4. Add Supabase Auth middleware and admin role policies before enabling admin mutations.
5. Configure real allowed hosts and encrypted URLs in the database. Never place them in `NEXT_PUBLIC_*` variables.

The demo deliberately uses `affiliate.example.test`; no real CPS URL, token, or promo code is included.

When `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` contain real values, the app automatically switches from local encrypted JSON to Supabase REST. The service-role key remains server-only. Check the active repository at `/admin/settings`.
