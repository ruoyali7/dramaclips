# Official social publishing migration

## Current architecture

The current production path is:

```text
R2 video URL
  -> publish_packages schedule
  -> lease_yixiaoer_publish_job
  -> Railway hook_worker
  -> Yixiaoer upload and per-platform publish
  -> publish_packages.yixiaoer_results + publish_platform_attempts
```

The names of several database columns and RPCs contain `yixiaoer`, but they are also the existing generic queue, lease, progress, and result store. Renaming them is not required for Phase 1 and would make the migration larger and riskier.

Relevant files:

- `lib/admin/publish-repository.ts`: creates packages, schedules and retries them, leases jobs, and writes worker updates.
- `app/api/admin/publish-packages/[id]/yixiaoer/route.ts`: queues validation, publishing, retries, and reconciliation.
- `worker/hook_worker/main.py`: leases scheduled work, prepares Yixiaoer media, publishes each platform independently, and records results.
- `worker/hook_worker/publish_state.py`: duplicate prevention, resume rules, and aggregate terminal status.
- `lib/admin/yixiaoer.ts`: control-plane Yixiaoer payload and CLI helpers.
- `supabase/migrations/202608130001_publish_packages.sql`: initial package table.
- `supabase/migrations/202608170002_publish_reconciliation.sql`: per-platform attempts and reconciliation states.
- `supabase/migrations/202609040003_publish_worker_control_plane.sql`: bounded lease/progress update RPC and Vault-backed Yixiaoer key.
- `supabase/migrations/202609270001_serialize_yixiaoer_publish_jobs.sql`: serialized scheduled-job leasing.

The R2 ingestion and scheduling layers do not need to change. `publish_platform_attempts` already stores a provider request ID, platform post ID, provider response, error, and independent state for each platform. This is enough for Meta Phase 1 without a database migration.

The TypeScript `PublishingProvider` in `lib/admin/publishing-provider.ts` is not the active scheduled publishing path. The Railway worker is the correct place for the Phase 1 adapter.

## Phase 1 implementation

`worker/hook_worker/meta_publisher.py` adds the two official API flows:

```text
Instagram: create container -> poll FINISHED -> media_publish
Facebook:  start Reel -> hosted URL upload -> finish PUBLISHED -> poll status
```

`worker/hook_worker/main.py` routes Instagram and Facebook independently. The defaults remain Yixiaoer, so merging this code does not switch production behavior. YouTube and TikTok remain on Yixiaoer and can later add providers at the same routing point.

Provider selection:

```env
INSTAGRAM_PUBLISH_PROVIDER=yixiaoer # or meta
FACEBOOK_PUBLISH_PROVIDER=yixiaoer  # or meta
```

Meta configuration (Railway server secrets only):

```env
META_APP_ID=
META_APP_SECRET=
META_GRAPH_API_VERSION=v24.0
INSTAGRAM_USER_ID=
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
```

The app ID is used during Meta app setup and token acquisition. The worker uses the app secret to send `appsecret_proof`. The Page access token is sent only in authorization headers and is never returned to the frontend or written into publishing results.

The direct publishers reuse the existing R2 URL. The URL must be reachable by Meta and remain valid for the full ingestion window. A private or short-lived signed URL can fail after a job has been accepted.

## Reliability behavior

- A platform already marked `published` is skipped.
- An explicit retry targets only the selected failed platform.
- Instagram saves its container ID before polling or publishing.
- Facebook saves its video ID and upload URL before transfer, then saves each stage before the next request.
- Safe status GETs retry transient network and rate-limit responses up to three times.
- POST requests are never automatically repeated after a network timeout. They become `outcome_unknown` because Meta may have accepted the operation.
- Facebook ambiguous outcomes can be reconciled from the saved video status. Instagram ambiguous `media_publish` calls stay blocked unless the result can be verified; the worker does not create a second Reel.
- Confirmed API errors are recorded as a failed platform and do not stop the other platforms.

## Meta setup

This implementation uses Instagram API with Facebook Login so one Page access token can serve a Facebook Page and its linked Instagram professional account.

1. Create or select a Meta Business app and add the Facebook Login/Instagram API products required by the current dashboard.
2. Connect a Facebook Page to an Instagram Business or Creator account.
3. Request `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish` for the authorizing user/token.
4. Obtain the Page access token and the connected `instagram_business_account.id`; store them as Railway secrets.
5. Keep the app in Development mode only for app-role test users and owned test assets. Before use by people or businesses outside app roles, complete the access level, business verification, and App Review steps shown for these permissions in the Meta App Dashboard.
6. Treat a Page token as revocable even when it has no displayed expiry. Monitor OAuth error code 190 and replace/re-authorize the token before enabling retries.

Official API references:

- [Meta Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [Meta Facebook API collection](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api)

## Migration risks and validation gate

The code change is medium complexity; external authorization and media compatibility are the larger risks.

- Facebook Page Reels currently have stricter duration/aspect requirements than Instagram Reels. Existing clips must be checked before enabling Facebook direct publishing.
- R2 CORS is not the deciding factor for server ingestion, but public reachability, redirects, content length/type, and URL lifetime are.
- Meta permissions, access levels, and supported Graph versions change over time. Reconfirm them in the App Dashboard before production enablement.
- A live publish is intentionally not part of automated tests. It requires an explicitly authorized test clip and test accounts.
- Keep both provider switches on `yixiaoer` until one Instagram Reel and one Facebook Reel have been published and their IDs, captions, public URLs, and database attempts have been verified.

No Yixiaoer code or historical columns should be removed until Instagram, Facebook, YouTube, and TikTok have each passed their migration gate.
