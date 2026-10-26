# HeatGuard functional QA audit — October 25, 2026

Base: `codex/deploy-live` at `6ff259951df320771a333752b377b42bafdda8b0`. Fix branch: `codex/qa-functional-fixes`. Target: `codex/deploy-live`. A dedicated code-audit agent implemented the fix set; the parent reviewed the code, added the cold-start notification guard, ran final checks and owns release verification. The delegated agent reached its usage limit after preserving its source changes. This is a substantive audit, not proof that every possible bug is absent.

## Corrected behavior

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

## Checks actually run

- Parent TypeScript check and all **191 tests passed** after final source review. Seventeen added regressions cover session/monitoring lifecycle, private/local write epochs, post-erase saves, overlapping contacts/index rollback, phone validation, native map regions and outfit snapshots. These fixtures do not use real health/contact/location data.
- Final web/iOS/Android JavaScript/Hermes exports passed to `work/qa-final-export`. They do not establish signed builds, Swift compilation or physical-device behavior.
- Baseline browser checks: all six tabs, whole Arlington/combined maps, pin search/details, external directions handoff, nearest-AC candidate caveats, invalid/valid route waypoints, route weather, sketch reset, seven-day/hourly forecast, start/break/end web timer, heat-kit validation and read-only community loading worked. The phone form bug was reproduced with a disposable fictional contact and removed immediately; no SMS was sent. No fake community report was published. Desktop and 390×844 map/profile layouts were checked. No console errors were reported.
- Post-fix live regression checks follow production deployment. Native notification/monitoring/GPS/HealthKit/Watch acceptance remains untested on actual devices; no medical validity or guaranteed safety claim is made.

No medical thresholds, AI provider, datasets, dependency lockfile or Supabase schema were changed. Preserve existing known coverage and platform limitations. See CLAUDE-HANDOFF.md for continuation instructions.
