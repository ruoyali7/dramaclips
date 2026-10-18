# Local publishing development and test guide

This workflow keeps `npm run dev` unchanged and does not deploy Railway or Vercel. Its default is `mock`, which never calls Meta, YouTube, TikTok, or Yixiaoer publishing endpoints.

## 1. One-time setup

Install Docker Desktop and the Supabase CLI, then from the repository root run:

Open Docker Desktop once, accept its first-run prompts, and wait until the Docker Engine is running before starting Supabase.

```bash
npm install
python3 -m venv .venv-story
.venv-story/bin/pip install -r worker/requirements.txt
supabase start
supabase db reset --local
supabase status -o env
```

Create `.env.development.local` (it is covered by `.gitignore`). Copy the local values printed by `supabase status -o env`; do not reuse `.env.local` if it points at a hosted project.

```dotenv
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<local SERVICE_ROLE_KEY>
CPS_URL_ENCRYPTION_KEY=<64 hex characters used only for local data>
ADMIN_SESSION_TOKEN=<local-only random value>
HOOK_WORKER_TOKEN=<local-only random value>
CONTROL_PLANE_URL=http://127.0.0.1:3000

SOCIAL_PUBLISH_MODE=mock
MOCK_PUBLISH_OUTCOMES=
INSTAGRAM_PUBLISH_PROVIDER=meta
FACEBOOK_PUBLISH_PROVIDER=meta
```

The application and Worker both reject publishing mutations when a development process points at an arbitrary hosted Supabase URL. A separate hosted development project is supported only when both values are set and the URL hostname matches the project ref exactly:

```dotenv
ALLOW_REMOTE_DEVELOPMENT_DB=true
DEV_SUPABASE_PROJECT_REF=<development-project-ref>
```

Never use the production project ref here.

## 2. Run locally in safe mock mode

Terminal 1:

```bash
supabase start
npm run dev
```

Terminal 2, continuous Worker:

```bash
npm run worker:publish:local
```

For a single drain-and-exit run, use the exact Worker command:

```bash
zsh worker/scripts/run-local-publish-worker.zsh --once
```

In the local admin Publish Center, create a package or schedule and confirm publishing. The Worker leases only the local Supabase job. Successful mock results contain deterministic `mock-request-*` and `mock-post-*` IDs, so rerunning a completed platform does not create a new identity.

Simulate provider outcomes without contacting a provider:

```dotenv
MOCK_PUBLISH_OUTCOMES=instagram:success,facebook:failed,youtube:timeout,tiktok:processing
```

Allowed values are `success`, `failed`, `timeout`, and `processing`. Restart the Worker after changing the file. Inspect `publish_packages` and `publish_platform_attempts` in local Supabase Studio at `http://127.0.0.1:54323`.

## 3. Test the official Meta API with designated accounts

Use only an Instagram professional test account and Facebook Page dedicated to testing. Put these values only in `.env.development.local`:

```dotenv
SOCIAL_PUBLISH_MODE=test
ALLOW_REAL_TEST_PUBLISH=true
INSTAGRAM_PUBLISH_PROVIDER=meta
FACEBOOK_PUBLISH_PROVIDER=meta
META_GRAPH_API_VERSION=v24.0
META_TEST_INSTAGRAM_USER_ID=<test Instagram user ID>
META_TEST_FACEBOOK_PAGE_ID=<test Facebook Page ID>
META_TEST_PAGE_ACCESS_TOKEN=<test Page access token>
META_TEST_APP_SECRET=<test Meta app secret>
META_TEST_ALLOWED_ACCOUNT_IDS=<same Instagram ID>,<same Page ID>
```

Test mode never falls back to the production Meta variables and rejects any account ID outside `META_TEST_ALLOWED_ACCOUNT_IDS`. It also blocks Yixiaoer, YouTube, and TikTok publishing. Use an authorized, publicly reachable R2 test clip URL because Meta must fetch the media. First choose Validate; then publish one clip after checking the selected test account in the UI. Review the Worker output, `publish_packages.yixiaoer_results`, and `publish_platform_attempts`.

To return to no-network testing, set `SOCIAL_PUBLISH_MODE=mock` and remove or set `ALLOW_REAL_TEST_PUBLISH=false`.

## 4. Required tests before launch review

```bash
npm run test:publishing
npm run typecheck
npm test
npm run build
git diff --check
```

The focused suite covers mock success, failure, timeout, processing, deterministic duplicate prevention, Meta request timeout handling, safe GET retries, test-account allowlisting, provider routing, and database isolation. The full suite protects the existing pipeline.

Manual local acceptance checklist:

1. Mock success reaches `published` and creates one platform-attempt row per platform.
2. Mock failure reaches `failed`; Retry changes only an unpublished platform.
3. Mock timeout reaches `outcome_unknown`; Retry stays blocked until reconciliation.
4. Re-running a published package does not create a second platform post identity.
5. A Worker configured with a non-allowlisted hosted Supabase URL refuses to start.
6. Meta Validate reads the designated test account without creating a Reel.
7. One confirmed Meta test publish records the provider request ID and platform post ID.

YouTube and TikTok official integrations remain a later phase. Yixiaoer stays intact and production defaults remain `SOCIAL_PUBLISH_MODE=live` with the existing provider switches.
