# Live web hosting

Live app: https://heatguard-tan.vercel.app/

Vercel project: `heatguard` in Andy Tran's projects (Hobby). Production follows **`codex/deploy-live`**. The deployment branch starts from Claude UI commit `bcaa154fbec49312429a5a5dc5c74d4388054fa8`; `main` still holds an older app version. Hosting changes are reviewed in [PR #2](https://github.com/aetyiuon/heatguard/pull/2).

The Vercel deployment serves the Expo web export and the existing weather/relief API at the same HTTPS origin. Native iPhone, Android and Watch releases remain separate builds.

## Vercel

Import `aetyiuon/heatguard`, select the deployment branch, choose Other for framework, and use Node 24. `vercel.json` pins the package manager, runs the Expo export and publishes `dist`. It builds the browser with `EXPO_PUBLIC_API_URL=/api`; no localhost API address is embedded in the live build. `/api/*` is routed to the Node function in `api/index.ts`. The Node adapter reads traced city JSON files from `src/data`; Expo retains lazy imports for browser/native bundles. Keep these loaders separate because Metro does not accept Node JSON import attributes.

The adapter retains request validation, data provenance, original acquisition timestamps and missing-data behavior. Browser API requests must come from the site's own origin. The optional AirNow key remains a server-only `AIRNOW_API_KEY`; without it the UI explicitly marks AQI unavailable. Native clients keep using an explicitly configured HTTPS API URL. In-process upstream caching and the fallback rate limiter are per function instance, not a globally coordinated abuse limit.

Verify `/api/health`, `/api/weather?lat=32.7902&lon=-97.116`, the Today screen, the Relief Map and a journey before distributing the production URL. Check a clean browser session as well as the authenticated owner session. An Expo export does not verify native binaries or device behavior.

## Updates

For Codex or Claude changes, create a feature branch from `codex/deploy-live` and open a pull request targeting `codex/deploy-live`. This private repository is hosted on a Vercel Hobby team: collaborator-authored commits are blocked from Git deployment even when pushed to the production branch. The owner must review the actual changes and publish an owner-authored integration/release commit. Keep the collaborator's original commits and attribution; do not rewrite their identity or force-push history. An owner-authored commit on the production branch triggers Vercel; verify READY and the live app before calling a release complete. Collaborator preview builds can also be blocked by the same plan restriction; local checks remain available without Vercel/Supabase access. Changes made only on `main` or `claude/ui-redesign` do not update production. Keep `vercel.json`, `api/`, the server adapter and the current lockfile when changing the UI. Supabase schema/function changes require a separate migration/function deployment; a Vercel Git push does not deploy them. Keep secrets in Vercel's encrypted environment settings, never in source or `EXPO_PUBLIC_*` values.

## Supabase community storage

The dedicated HeatGuard project is `ljoluomippttmxosfscz` in the user-selected AgoraAI organization. Set Vercel's server-only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` variables. The browser never receives an administrator key. Vercel forwards only explicit community requests to `heatguard-community`; the Edge Function checks its publishable key and uses its own injected server key to access the database.

`supabase/schema.sql` defines the community tables, constraints, indexes and atomic minute-bucket limits. RLS is enabled and direct anonymous/authenticated table grants are revoked. No public RLS policies are intentional: only the validated service backend accesses these tables. Supabase's `rls_enabled_no_policy` informational advisory therefore describes the intended backend-only model, not a request to expose the tables. Secrets and hashed actor IDs are never returned by the feed.

Community writes still require the app's explicit sharing consent. Feeling locations are rounded to about 1 km; shared amenity suggestions are deliberately public approximate locations. Expired pins/reports are filtered and physically removed when the feed is read (votes cascade with pins). Without traffic, expired rows can remain until the next feed read. Anonymous install IDs are not authenticated people, and rate limits are abuse friction, not proof of identity or facility status. No new user accounts or profile synchronization have been added.

The core weather, map and journey flows do not require cloud profile storage. Profiles, contacts, route recordings and biometrics remain in their existing local/memory storage; hosting does not opt users into sharing them.


## Owner release review - October 25, 2026

Collaborator commit `89c401955a652e2b31173ed2930f3236b7ed7479` adds emergency-number suggestions, low-heat presentation, web accessibility states and hash-based tab navigation. It was downloaded and reviewed against deployed commit `dd488bc3b5e19d5df4ef7d50b70177ea87748c40`. The owner release retains that commit and changes only the deployment/collaboration handoff and verification record. It does not change account access, plan, repository visibility, server credentials or database schema.

Vercel's owner dashboard also blocks redeploying the original collaborator-authored commit. The supported Git eligibility rule requires the deployed tip to be authored by the Hobby team's owner. See https://vercel.com/docs/deployments/troubleshoot-project-collaboration#hobby-teams. A real owner review/integration commit must follow future collaborator changes; a collaborator push alone is not a successful deployment.
