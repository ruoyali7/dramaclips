# Public UX implementation plan

Branch: `feature/public-ux-optimization`

Each phase must pass focused tests plus `npm run typecheck` and `npm run build` before the next phase is considered complete. `npm test` is run at milestones and before handoff. No production deployment or merge is included.

## Phase checklist

1. **Repository audit and baseline — complete**
   - Document routes, referral flow, event contract, mobile breakpoints, risks, and baseline checks.
2. **Referral CTA consolidation — complete**
   - Route every public provider CTA through `/go/[slug]`.
   - Add one shared client-event helper and one shared affiliate CTA.
   - Keep clipboard behavior best-effort and report success truthfully.
   - Treat one client outbound-intent event plus one server redirect event as the funnel boundary.
   - Verification: 146 tests, production build, typecheck, and `git diff --check` passed.
3. **Mobile watch page and empty preview state — complete**
   - Preserve player behavior while improving controls, end state, safe areas, watched markers, and zero-episode fallback.
   - Verification: production build, typecheck, and `git diff --check` passed; full test suite remained at 146 passing tests from the preceding phase.
4. **Social landing resolution — complete**
   - Resolve valid identifiers directly to `/watch`; show an explicit search fallback for invalid identifiers without breaking old parameters.
   - Verification: 7 focused routing/attribution tests, production build, typecheck, and `git diff --check` passed.
5. **Homepage discovery redesign — complete**
   - Remove unsupported labels, prioritize search/history/catalog, and keep real episode counts.
   - Reused the existing acquisition-first layout; removed the unsupported “Newly added” claim rather than rewriting the page.
6. **Smart search — complete**
   - Add deterministic ranked matching, up to five accessible suggestions, and no per-keystroke database calls.
   - Verification: 9 focused search/routing/attribution tests, production build, typecheck, and `git diff --check` passed.
7. **Multi-drama local history — complete**
   - Add versioned, bounded storage with safe migration from `dramaclips:last` and guarded reads/writes.
   - Favorites remain deferred unless the core phases finish without added complexity.
   - Favorites are deferred because they are optional and would add a separate interaction/storage surface.
   - Verification: 5 focused migration/storage tests, production build, typecheck, and `git diff --check` passed.
8. **Deterministic recommendations — complete**
   - Rank published alternatives by shared tags with stable fallback ordering.
   - Verification: 2 focused ranking tests, production build, typecheck, and `git diff --check` passed.
9. **Public conversion funnel — complete in code; migration not applied**
   - Define documented denominators and expose visits, starts, completions, outbound intent, and confirmed redirects without calling them purchases.
   - Added distinct-session funnel stages and source/drama breakdowns while preserving existing analytics fields.
   - `202610190001_public_conversion_funnel.sql` requires review and explicit deployment approval before the new dashboard fields contain data.
   - Verification: 7 focused funnel/period/event tests, production build, typecheck, and `git diff --check` passed.
10. **Accessibility, performance, and regression QA — complete for automated coverage**
    - Verify keyboard names/states, 44px touch targets, reduced motion, responsive images, layout stability, and existing Admin/publishing tests.
    - Verification: 52 test files and 160 tests passed; production build, typecheck, and `git diff --check` passed.
    - Browser screenshots, iOS Safari, real-device layout checks, Lighthouse, and production analytics verification remain pending because no browser runner is installed and production changes are not authorized.

## Commit strategy

Use small commits aligned to the checklist rather than a page-wide rewrite:

1. Audit documents.
2. Referral and event consolidation.
3. Watch-page resilience and mobile behavior.
4. Landing and discovery/search behavior.
5. History and recommendations.
6. Analytics funnel.
7. Accessibility, styling, and final regression fixes.

## Verification evidence

Results and known limitations are updated here at each phase boundary and summarized in the final handoff.

## Phase report

### 0. Audit and baseline

- **What/why:** Documented real public routes, attribution, event contracts, mobile behavior, baseline failures, and compatibility risks before changing code.
- **Files:** `docs/public-ux-audit.md`, this plan.
- **Tests:** Baseline 145 tests passed; build passed; post-build typecheck passed. The existing lint script is interactive and could not run unattended.
- **Risk:** Legacy `/d` and `/l` pages remain for compatibility.

### 1. Referral CTA consolidation

- **What/why:** Routed public provider CTAs through `/go/[slug]`, retained one client outbound-intent event, kept clipboard optional, and removed sensitive destinations from client drama props.
- **Files:** shared client event/CTA utilities, watch page/player, public-drama projection, client drama consumers.
- **Tests:** Focused redirect/event/projection tests, full suite, build, and typecheck passed.
- **Risk:** Historical `watch_full_click` records remain in analytics, while new CTAs use `rs_redirect_click` as the single intent event.

### 2. Mobile watch and empty previews

- **What/why:** Added a zero-preview poster/referral fallback, kept page-view measurement, improved safe-area spacing and touch targets, and clarified the final-preview end state.
- **Files:** watch page, player, empty state, watch tracker, global public styles.
- **Tests:** Build and typecheck passed; full suite remained green.
- **Risk:** Real iOS/Android playback and viewport behavior still needs device testing.

### 3. Social landing resolution

- **What/why:** Valid `d`, `code`, and retained legacy clip identifiers now resolve directly to the intended watch page; unknown identifiers show a search recovery state.
- **Files:** homepage, `lib/catalog-routing.ts`, public styles.
- **Tests:** 7 focused routing/attribution tests, build, and typecheck passed.
- **Risk:** The legacy `3469908` clip special case is intentionally preserved.

### 4. Homepage discovery

- **What/why:** Reused the existing acquisition-first layout and replaced the unsupported “Newly added” badge with a neutral featured-preview label.
- **Files:** homepage.
- **Tests:** Typecheck passed; covered by subsequent full build and regression suite.
- **Risk:** No editorial featured-drama field exists, so the first published catalog item remains the feature fallback.

### 5. Smart search

- **What/why:** Added local instant suggestions, exact-code-first deterministic ranking, keyboard navigation, touch results, empty recovery, and attribution preservation without per-keystroke requests.
- **Files:** search component/page, homepage, catalog routing, public styles.
- **Tests:** 9 focused search/routing/attribution tests, build, and typecheck passed.
- **Risk:** Suggestions are limited to catalog data already loaded with the page.

### 6. Multi-drama history

- **What/why:** Added versioned history for up to 10 dramas, safe legacy migration, guarded storage operations, and three recent homepage resume cards.
- **Files:** history utility, player, continue-watching component, public styles.
- **Tests:** 5 focused history tests cover corruption, migration, upsert, cap, and unavailable storage; build and typecheck passed.
- **Risk:** Favorites were deferred as optional scope.

### 7. Recommendations

- **What/why:** Replaced positional recommendations with stable shared-tag and playable-preview ranking.
- **Files:** recommendation utility and watch page.
- **Tests:** 2 focused ranking tests, build, and typecheck passed.
- **Risk:** Sparse tags fall back deterministically by preview availability and title.

### 8. Conversion analytics

- **What/why:** Added a unique-session public funnel and source/drama breakdowns while separating outbound intent, confirmed redirects, and provider purchases.
- **Files:** Analytics page/repository/styles, funnel utility, `202610190001_public_conversion_funnel.sql`.
- **Tests:** 7 focused analytics tests, build, and typecheck passed.
- **Risk:** The migration is committed but unapplied; live funnel values require migration review and explicit deployment approval.

### 9. Accessibility, performance, and regression QA

- **What/why:** Added truthful copy-failure announcements, video labeling, empty-search browse recovery, shared resilient event delivery, touch targets, reduced-motion preservation, and responsive image sizing.
- **Files:** homepage tracker, search, player, public styles.
- **Tests:** 52 files / 160 tests passed; production build, typecheck, and diff checks passed. Public first-load bundles remain 115–116 kB for homepage/watch in the build report.
- **Risk:** `npm run lint` remains unavailable because the pre-existing `next lint` command launches interactive setup. Playwright is not installed, so screenshots, browser matrix, Lighthouse, and real-device targets are not claimed.

## Deployment and configuration

- No environment variable changes.
- No production deployment, Supabase migration application, merge, or push was performed.
- No Admin publishing, worker, R2 ingestion, publishing integration, or Generate Hook implementation files were modified.
