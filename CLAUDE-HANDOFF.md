# HeatGuard handoff to Claude — October 25, 2026

## Start from the deployed branch

Repository: https://github.com/aetyiuon/heatguard (private). **`codex/deploy-live` is the production branch.** Start UI or other follow-up work from its latest clean tip, not the historical `codex-fix-nearest-ac-directions`, `claude/ui-redesign` or older `main`. Read AGENTS.md and COLLABORATION.md first. This QA task was implemented on `codex/qa-functional-fixes`, based on production `6ff259951df320771a333752b377b42bafdda8b0`, and merged into `codex/deploy-live`. See QA-AUDIT.md and VERIFICATION.md for actual release status; do not assume a feature branch is deployed.

In your own Git clone with no uncommitted work:

```sh
git status --short --branch
git fetch origin
git switch codex/deploy-live
git pull --ff-only
git switch -c claude/ui-follow-up
```

The last branch name is an example for a new task. Preserve uncommitted work and coordinate shared files before changing branches. ZIP downloads have no Git history; never commit into an accidental parent repo. Open a PR targeting `codex/deploy-live`; never force-push shared branches. A Vercel Hobby owner integration/release is needed when collaborator commit authorship blocks deployment. Collaborators do not need the owner's Vercel, Supabase or provider keys for UI work. Do not share credentials or change repository visibility.

## Verified QA release

QA fixes were merged through [PR #8](https://github.com/aetyiuon/heatguard/pull/8) as `67dc75bb22a51ea63d4d320dffdc9909355c662c`. Vercel production deployment `9amD4L4KybnuB5k5ZQrZqAg1paVq` reached READY at https://heatguard-tan.vercel.app/. All 164 files in the published feature ZIP matched the tested workspace after line-ending normalization; credential-pattern scan found none. The following owner handoff commit updates documentation only. Start from the latest `codex/deploy-live`, which includes this release and its final verification notes.

Post-release checks confirmed the corrected editor, rejected punctuation-only contact number, explicit saved origin in pin directions, and community sharing reset after a public-preset location change. Health endpoint returned HTTP 200 with Groq/community configuration available. A clean browser startup/editor/map session reported no console errors. Current cool weather correctly hides a new cooling-timer start; controlled hot-weather/async regression tests cover lifecycle behavior. Native delivery and actual device behavior remain unverified.

## Current product and implementation

HeatGuard uses TypeScript, React Native and Expo for web/iOS/Android. It has a navy/mint translucent glass theme, amber sun logo, pressed-button effect, desktop sidebar and six phone tabs. Preserve the palette, shared glass controls, English/Spanish strings, accessibility and Reduce Transparency fallback. UI entry points: App.tsx; src/screens/; src/ui/theme.ts, glass.tsx, components.tsx and RaisedPressable.tsx. Keep native/web map implementations in view.

Core features include live public weather, forecast, local cooling-break planning/session timer, city-first relief maps with district portions and combined source coverage, nearest mapped AC candidate review, route sketches/foreground GPS recordings, personal check-ins, heat-kit outfits and optional community reports/contacts. Datasets remain dated published snapshots with incomplete fountain/shade/access coverage. A park is not proof of shade, a library is an unverified AC candidate, and a straight line is not routed walking directions. Distances and directions should use the named heat-check location consistently. Map browsing does not change that location.

Optional Groq AI uses `openai/gpt-oss-20b` and a server-only Production Secret. City-only mode sends public city weather only. Personal mode can send the explicitly reviewed saved profile/latest check-in with separate consent; inputs and language/city changes revoke that consent. Personal AI is not shared-cached or saved to Supabase. Prose can repeat entered facts and is still sensitive/fallible. Do not introduce free-text clinical records, identifiers, route/GPS history or silent data sharing. Read AI.md before editing that path. No personal health entries belong in tests, PRs, logs or screenshots; use fictional fixtures.

Existing local calculation controls minutes and stop rules. It is conservative planning policy, not a validated prediction of individual heat tolerance or guaranteed safe time outside. AI does not calculate/extend minutes. Preserve freshness, symptoms, hydration/temperature/pulse caution gates and source labels. Do not change medical thresholds or make wearable readings award additional minutes as part of a UI task. Actual metabolism is not measured. Apple Watch/HealthKit and notifications require native builds, signing and physical-device acceptance; the browser correctly disables wearable connection.

## QA corrections to preserve

- Session transitions use a versioned lifecycle controller: a late notification permission/scheduling result cannot restart an ended, moved or cleared session, and stale reminder IDs are canceled.
- Monitoring operations are serialized; stale enables are disabled before newer settings run. Workload/language updates follow the latest requested settings, and failed enables do not silently retry.
- Local-data deletion invalidates pending restoration, GPS, map, weather and cooling searches, drains private saves, and prevents old cache responses from recreating deleted location caches. Contact mutations read the live collection inside the queue and keep record/index writes consistent.
- Startup renders a short restoration view before interactive controls. Cold-start notification refresh waits for the saved place to restore, and the previous response is read once rather than re-triggered on every location change.
- Explicit native point focus wins over city bounds, including coordinates equal to zero. Pin/list walking directions include the saved heat-check origin.
- Contact phones require real digits and are normalized; punctuation-only numbers fail. No SMS is sent automatically.
- Outfits deduplicate trimmed names, and saved confirmation matches the actual saved snapshot; editing pending/saved drafts cannot claim unsaved changes are stored.
- Community results and sharing consent are bound to the selected location; stale replies do not appear on a different area's map.
- Profile editing is clearly an editor display control, not a false usage-consent switch. Edit my health profile opens the editor even on the profile tab. Privacy copy distinguishes ordinary weather from optional personal-AI sharing.

The new helpers in src/domain/session.ts, mutations.ts, buddy.ts, outfits.ts and mapRegion.ts are tested behavior, not incidental UI code. Do not remove their sequencing guards during styling changes.

## Validation and next step

Final source: TypeScript and **191 tests passed** (174 baseline plus 17 QA regressions). Final web/iOS/Android JavaScript/Hermes exports passed to `work/qa-final-export`; post-release smoke checks are recorded in VERIFICATION.md. JavaScript/Hermes exports do not establish signed builds, Swift compilation, Watch/GPS accuracy or actual notification delivery. Native permission and storage races use controlled async fixtures; physical-device acceptance remains required. No dependency, medical-method, dataset or Supabase schema changes were needed for this audit.

Read QA-AUDIT.md for fixes and fresh browser checks. Before new work, inspect the latest production tip and your diff. Run `pnpm typecheck`, `pnpm test` and exports appropriate to touched platforms. For shared client changes, `pnpm exec expo export --platform all --output-dir work/claude-check` is a JavaScript/Hermes check. Use Node 24+ and pnpm 11+ with the committed lockfile. Start the local API with `pnpm proxy` and web with `pnpm web`; see README.md and IPHONE-TESTING.md for setup and honest missing-key behavior.

Suggested next prompt:

> Read AGENTS.md, CLAUDE-HANDOFF.md, QA-AUDIT.md and VERIFICATION.md on the latest codex/deploy-live. Inspect branch/status/diff before editing. Implement my next UI request in a separate feature branch while preserving the QA lifecycle guards, personal-AI consent, local heat calculation, map provenance and truthful native states. Test affected desktop/phone flows and leave a concrete PR/handoff targeting codex/deploy-live.
