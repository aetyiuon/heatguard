# Verification and known limits

## Scope of this record

Production branch: **codex/deploy-live**. The consolidated baseline is `a5efa7b00e31f451b8ffb112f7bc5fc812a4d122`, the documentation handoff after QA merge [PR #8](https://github.com/aetyiuon/heatguard/pull/8), `67dc75bb22a51ea63d4d320dffdc9909355c662c`. This guide replaces overlapping handoff/QA/history documents; prior dated logs remain in [Git history](https://github.com/aetyiuon/heatguard/blob/a5efa7b00e31f451b8ffb112f7bc5fc812a4d122/VERIFICATION.md). Historical tests are not represented as new executions.

## Recorded release checks — October 25, 2026

- TypeScript and 191 automated tests passed, including seventeen lifecycle/privacy/map/contact/outfit regressions. Final web/iOS/Android JavaScript/Hermes exports passed. These are not signed binaries, Swift compilation, hardware tests or clinical validation.
- QA production deployment reached READY. Published source matched the tested snapshot after newline normalization. Post-release health returned HTTP 200 with Groq/community configured; configuration is not by itself proof of inference.
- Live browser checks confirmed same-tab profile editing, punctuation-only phone rejection without creating a contact, saved public origin in pin directions and location-bound community-sharing reset. No SMS or community post was sent. A clean startup/editor/map session had no app console errors; an isolated observer error in an older automation tab did not reproduce and was not attributed to source.
- All six tabs, bundled maps/search/clusters/source details, candidate directions, route-weather results, forecast and English/Spanish larger-text layouts were exercised in the documented QA/video checks. Current cool weather correctly suppresses a new heat timer. Controlled tests cover hot/async transitions; this is not current live hot-weather or native delivery acceptance.
- Real Groq personal generations in English and Spanish were verified in the earlier [PR #7 release record](https://github.com/aetyiuon/heatguard/blob/a5efa7b00e31f451b8ffb112f7bc5fc812a4d122/VERIFICATION.md#personal-explanation-quality-follow-up---october-25-2026). Only fictional profile/check-in fixtures were used. Missing consent and emergency/check-in stop inputs were rejected. Model success is not evidence of medical accuracy.

## QA safeguards to preserve

1. **Canceled session work:** permission/scheduling promises could finish after End, a place/activity change or deletion and recreate a session/reminders. Versioned start/resume/reconcile operations commit only current transitions and cancel stale notification IDs.
2. **Monitoring lifecycle:** late enables could restore outdated background monitoring. Serialized operations disable stale registrations before newer requests, retain latest context and clean up partial enable failures.
3. **Deletion and late responses:** pending private saves, initial restore, nearby-map/GPS/cooling/weather requests and cache writes could restore cleared state or storage. Privacy epochs, drained writes, request versions and invalidation protect the clear boundary.
4. **Contact write ordering:** overlapping add/remove operations could use stale rendered arrays and lose the private contact index. The queue now reads a live collection and rolls back record changes when index persistence fails.
5. **Initial hydration:** an early edit could be overwritten by a saved-state restore. Interactive controls wait for initial restoration; cold-start notification refresh no longer uses the default place before saved location restoration.
6. **Native pin focus:** city bounds took precedence over an explicitly selected point. Explicit focus now wins, including latitude/longitude zero.
7. **Directions origin:** Relief pin/list directions omitted origin although distances used the named saved place. They now provide that same saved origin, as the nearest-AC flow already did.
8. **Phone validation:** punctuation-only phone entries were accepted. Formatted numbers now require 7–15 actual digits and are normalized before saving.
9. **Outfit save integrity:** padded names could duplicate a saved outfit/key; name/checklist changes could retain an obsolete saved label. Trimmed deduplication and snapshot-bound confirmation correct both, including edits during saving.
10. **Community scope:** a reply for a previous location could appear on the new map. Results, request completion and sharing choice are location-bound.
11. **Profile editor:** its toggle implied profile usage consent despite only hiding the form; Edit my health profile was a no-op when already on that tab. The label now describes editing and the button opens it.
12. **Privacy disclosure:** profile/deployment copy made an overly broad local-only claim after personal AI sharing was added. Copy now distinguishes ordinary weather, explicit personal-AI sharing, contacts and community storage.

## Outstanding acceptance and limitations

| Area                     | Remaining work / limitation                                                                                                                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native iOS/Android/Watch | Signed builds, Swift compilation, real HealthKit/Watch data, physical GPS accuracy, grant/deny/revoke, lock/resume and battery behavior remain unverified.                                                                |
| Notifications/background | OS scheduling, Focus/Silent behavior, cold starts and secure-storage hardware behavior require physical-device tests; no guaranteed delivery or background frequency.                                                     |
| Health guidance          | General public-guidance references plus conservative app policy. No clinical validation, heat-stroke prediction, physiological monitoring or safe-exposure guarantee.                                                     |
| Map data                 | Dated public records; incomplete fountain/shade coverage and unverified openings/access/water/AC. Full geography is not a complete amenity inventory.                                                                     |
| AI                       | Qualitative, fallible and separately consented. No control over minutes; no clinical interpretation; provider limits/retention apply. Process-local quota controls are not global spending limits.                        |
| Provider/feed paths      | Optional AirNow with real key and separately configured municipal feeds still need deployment-specific checks. Basemaps need network or existing cache.                                                                   |
| Community/SMS            | Production Supabase request paths were previously exercised. Anonymous IDs/votes do not prove identity or safety. SMS remains a reviewed composer, not automatic delivery. The optional Worker/D1 deployment is separate. |
| Security/accessibility   | Automated fixtures and browser checks do not replace a full device security, VoiceOver/TalkBack or usability audit. No assertion that every bug is absent.                                                                |

## Presentation cleanup — October 25, 2026

Based on a5efa7b, branch codex/presentation-cleanup. Consolidated root documentation into nine guides, replaced overlapping QA/handoff logs with this current record and historical links, removed the unused health adapter and mascot, and renamed the active sun component to BrandMark.tsx. Its SVG geometry and rendering are preserved. No dataset, calculation threshold, dependency, secret or database schema changed.

Checks actually run on the cleanup source:

- TypeScript --noEmit passed.
- All 191 tests passed, zero failed/skipped.
- Expo web, iOS and Android JavaScript/Hermes exports passed together. The first native attempt could not write to the sandbox temporary directory; rerunning with an ignored workspace temporary folder succeeded. No compiler/SDK upgrade was made.
- Relative documentation links and removed-path references were checked. Map/lock/config/schema/vendor source files were compared against the base snapshot.
- React review: active BrandMark JSX/geometry is retained; unused mascot SVG imports were removed; App.tsx changes only its import path. No hooks, props, state, events or accessibility semantics changed.

This local validation does not establish a new production deployment or native physical-device acceptance. Release status belongs in the cleanup PR.
