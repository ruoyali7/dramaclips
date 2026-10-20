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
7. **Multi-drama local history — in progress**
   - Add versioned, bounded storage with safe migration from `dramaclips:last` and guarded reads/writes.
   - Favorites remain deferred unless the core phases finish without added complexity.
8. **Deterministic recommendations — pending**
   - Rank published alternatives by shared tags with stable fallback ordering.
9. **Public conversion funnel — pending**
   - Define documented denominators and expose visits, starts, completions, outbound intent, and confirmed redirects without calling them purchases.
10. **Accessibility, performance, and regression QA — pending**
    - Verify keyboard names/states, 44px touch targets, reduced motion, responsive images, layout stability, and existing Admin/publishing tests.

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
