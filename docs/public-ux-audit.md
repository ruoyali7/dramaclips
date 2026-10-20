# Public UX audit

Audit date: 2026-10-19  
Branch: `feature/public-ux-optimization`  
Baseline commit: `c93ebbcb`

## Scope and constraints

This work is limited to the public acquisition, discovery, watch, referral, and measurement experience. Admin publishing, Railway workers, R2 ingestion, provider publishing integrations, and the paused Generate Hook system are out of scope. Production deployment and merge require separate approval.

## Current public routes

| Route | Current behavior | Status |
| --- | --- | --- |
| `/` | Catalog homepage, query-based matching, featured drama, search form, one-item resume strip | Active |
| `/watch/[slug]` | Published-drama preview player, episode navigation, resume, provider CTAs, recommendations | Active and primary conversion page |
| `/go/[slug]` | Server-side destination selection, `redirect_success` recording, session cookie, safe 302 redirect | Active but bypassed by some watch CTAs |
| `/go/[slug]/fallback` | Explains unavailable routes or destinations | Active fallback |
| `/x/[code]` | Resolves tracked short links and forwards to the public journey | Active |
| `/b/[platform]` | Platform entry route used by existing bio traffic | Active |
| `/search` | Redirects to the homepage query form | Active compatibility route |
| `/d/[slug]` | Older catalog detail page that links into `/watch` | Legacy but functional |
| `/l/[slug]` | Demo-data landing page with a small hard-coded slug allowlist | Legacy/demo |

## Confirmed data and attribution flow

- Published catalog data comes from Supabase drama drafts plus one seed fallback. Only published rows are exposed by the repository.
- Public attribution accepts `s`/`utm_source`, `m`/`utm_medium`, `c`/`utm_campaign`, `cl`/`utm_content`, `a`/`account`, `v`/`variant`, `h`/`utm_term`, and `sl`.
- `/x/[code]`, homepage links, drama cards, and watch links preserve the supported query keys.
- `/go/[slug]` selects an allowed destination server-side, records `redirect_success`, and keeps the decrypted provider URL off the rendered page.
- The watch page currently passes the decrypted provider URL to client components. Those components navigate directly to it, bypassing `/go/[slug]` and its server-side redirect record.

## Existing event contract

`POST /api/events` accepts schema version 1 and these client event names:

- `page_view`
- `episode_start`
- `episode_complete`
- `next_episode`
- `promo_code_copy`
- `watch_full_click`
- `rs_redirect_click`

The server derives the session from the `db_session` cookie, normalizes attribution, detects device class, removes unsupported metadata, and ignores authenticated Admin traffic. `/go/[slug]` additionally records server-side `redirect_success`.

## Confirmed UX and conversion problems

1. **Inconsistent referral routing (P0).** Watch CTAs use the decrypted `contentPromotionUrl` directly when present, so successful outbound navigation can have no server-side `redirect_success` record.
2. **Ambiguous outbound counting (P0).** A single CTA click can emit both `watch_full_click` and `rs_redirect_click`; the dashboard primarily counts the latter, while `/go` separately records `redirect_success`.
3. **Zero-episode crash (P0).** `EpisodePlayer` reads `episodes[0].episodeNumber` during render. A published drama without a playable preview cannot reach a graceful fallback.
4. **Copy wording overpromises (P0).** The mobile CTA always says the code copies automatically even when the Clipboard API is unavailable or permission is denied.
5. **Single-drama resume storage (P1).** `dramaclips:last` overwrites progress for every drama and unguarded writes can throw when browser storage is restricted.
6. **Search is server-submit only (P1).** Matching exists, but there are no instant suggestions or keyboard-selectable results.
7. **Featured label is unsupported (P1).** The homepage always labels the selected hero “Newly added” without a corresponding published-at guarantee.
8. **Recommendations are positional (P2).** Watch recommendations use the first three other dramas rather than deterministic relevance.
9. **Landing mismatch fallback is weak (P0).** Unknown `d`/`code` identifiers silently fall back to the first drama hero, which can appear to be the requested title.

## Existing mobile behavior

- Public breakpoints are primarily 700px, 760px, and 800px.
- The watch player becomes full-width below 760px and uses `100svh` sizing.
- A fixed mobile CTA is present, but safe-area padding and bottom spacing need tightening so content and controls remain unobstructed.
- Episode buttons are horizontally scrollable, but watched state is only inferred from the current in-memory index.

## Files expected to change

- Public pages: `app/page.tsx`, `app/watch/[slug]/page.tsx`, `app/search/page.tsx`
- Public components: watch CTA/player, search, continue-watching, drama cards
- Public utilities: client events, affiliate navigation, search/recommendation/history helpers
- Public styling: `app/globals.css`
- Analytics contract/dashboard only where required to define the public funnel
- Focused tests and, only if needed, a backward-compatible analytics migration

No worker, R2, provider publishing, or Generate Hook files should change.

## Baseline verification

| Check | Result |
| --- | --- |
| `npm test` | Passed: 48 files, 145 tests |
| `npm run build` | Passed |
| `npm run typecheck` | Passed after build generated `.next/types` |
| `npm run lint` | Not runnable non-interactively: `next lint` prompts to create ESLint configuration and exits 1 |
| Browser/device testing | Not yet run at baseline |

The initial typecheck was run concurrently with the build and failed because the build was replacing generated `.next/types`; the clean post-build typecheck passed. This is a command-order issue, not a source error.

## Compatibility risks

- Existing short links and attribution aliases must retain their current meaning.
- Event-name changes can make historical and new dashboard periods incomparable; funnel updates must preserve or explicitly coalesce the old names.
- Clipboard work must remain best-effort and must never delay or block provider navigation.
- Local-history migration must accept malformed and older `dramaclips:last` shapes without throwing.
- Public catalog code must continue to tolerate the seed fallback and a Supabase catalog with sparse metadata.
- Admin regression checks are required even though Admin code is not part of the intended change set.
