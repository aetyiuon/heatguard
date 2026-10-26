# Live web hosting

Live app: https://heatguard-tan.vercel.app/

Vercel project: `heatguard` in Andy Tran's projects (Hobby). Production follows **`production`**. Use the latest reviewed production tip; historical feature branches and `main` may contain older app versions.

The Vercel deployment serves the Expo web export and the existing weather/relief API at the same HTTPS origin. Native iPhone, Android and Watch releases remain separate builds.

## Vercel

Import `aetyiuon/heatguard`, select the deployment branch, choose Other for framework, and use Node 24. `vercel.json` pins the package manager, runs the Expo export and publishes `dist`. It builds the browser with `EXPO_PUBLIC_API_URL=/api`; no localhost API address is embedded in the live build. `/api/*` is routed to the Node function in `api/index.ts`. The Node adapter reads traced city JSON files from `src/data`; Expo retains lazy imports for browser/native bundles. Keep these loaders separate because Metro does not accept Node JSON import attributes.

The adapter retains request validation, data provenance, original acquisition timestamps and missing-data behavior. Browser API requests must come from the site's own origin. The optional AirNow key remains a server-only `AIRNOW_API_KEY`; without it the UI explicitly marks AQI unavailable. Native clients keep using an explicitly configured HTTPS API URL. In-process upstream caching and the fallback rate limiter are per function instance, not a globally coordinated abuse limit.

Verify `/api/health`, `/api/weather?lat=32.7902&lon=-97.116`, the Today screen, the Relief Map and a journey before distributing the production URL. Check a clean browser session as well as the authenticated owner session. An Expo export does not verify native binaries or device behavior.

## Optional AI city outlook

See [ai.md](ai.md) before enabling AI. Add `GROQ_API_KEY` as a server-only **Production Secret** and deploy again. The reviewed production model is `openai/gpt-oss-20b`, hosted by Groq; this needs no OpenAI API key. Keep the Groq account on its Free plan without a payment method. No paid/provider fallback is enabled. `/api/health` returns `ai` configuration status and `aiProvider`; verify an actual opt-in city outlook to confirm inference works. The previous blocked Gemini variables are unused. City-only mode sends only public weather. Personal mode separately allows reviewed saved profile/check-in fields after explicit consent; no routes, account identifiers or wearable histories are sent. All safety calculations remain local. No Supabase change is required. Per-process limits are not a global quota or spending cap.

## Updates

For Codex or Claude changes, create a feature branch from `production` and open a pull request targeting `production`. This private repository is hosted on a Vercel Hobby team: collaborator-authored commits are blocked from Git deployment even when pushed to the production branch. The owner must review the actual changes and publish an owner-authored integration/release commit. Keep the collaborator's original commits and attribution; do not rewrite their identity or force-push history. An owner-authored commit on the production branch triggers Vercel; verify READY and the live app before calling a release complete. Collaborator preview builds can also be blocked by the same plan restriction; local checks remain available without Vercel/Supabase access. Changes made only on `main` or `design/ui-redesign` do not update production. Keep `vercel.json`, `api/`, the server adapter and the current lockfile when changing the UI. Supabase schema/function changes require a separate migration/function deployment; a Vercel Git push does not deploy them. Keep secrets in Vercel's encrypted environment settings, never in source or `EXPO_PUBLIC_*` values.

## Supabase community storage

The dedicated HeatGuard project is `ljoluomippttmxosfscz` in the user-selected AgoraAI organization. Set Vercel's server-only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` variables. The browser never receives an administrator key. Vercel forwards only explicit community requests to `heatguard-community`; the Edge Function checks its publishable key and uses its own injected server key to access the database.

`supabase/schema.sql` defines the community tables, constraints, indexes and atomic minute-bucket limits. RLS is enabled and direct anonymous/authenticated table grants are revoked. No public RLS policies are intentional: only the validated service backend accesses these tables. Supabase's `rls_enabled_no_policy` informational advisory therefore describes the intended backend-only model, not a request to expose the tables. Secrets and hashed actor IDs are never returned by the feed.

Community writes still require the app's explicit sharing consent. Feeling locations are rounded to about 1 km; shared amenity suggestions are deliberately public approximate locations. Expired pins/reports are filtered and physically removed when the feed is read (votes cascade with pins). Without traffic, expired rows can remain until the next feed read. Anonymous install IDs are not authenticated people, and rate limits are abuse friction, not proof of identity or facility status. No new user accounts or profile synchronization have been added.

The core weather, map and journey flows do not require cloud profile storage. Supabase/community do not receive health profiles, route recordings or biometrics. Profiles and readings use local/memory storage unless the user separately reviews and opts into personal AI sharing with the HeatGuard server and Groq; contacts and route recordings are always excluded from AI. Hosting itself does not opt users into any sharing.

## Optional Cloudflare Worker / D1 deployment

The Worker adapter remains an alternative backend, not the live Vercel/Supabase path. Weather works without D1. Configure exact ALLOWED_ORIGINS, a real NWS contact and server-only secrets, then run `pnpm deploy:proxy`. For Worker community writes, provision D1, bind it in `wrangler.toml`, apply `backend/schema.sql` and configure COMMUNITY_SALT. D1 setup must not be applied as PostgreSQL; `supabase/schema.sql` is the distinct production schema.

```sh
pnpm deploy:proxy
npx wrangler secret put AIRNOW_API_KEY
# Optional Worker community only, after provisioning/approval:
npx wrangler d1 execute heatguard-community --remote --file backend/schema.sql
npx wrangler secret put COMMUNITY_SALT
```

Worker reports/pins expire from feeds; storage cleanup still needs a retention job. Configure moderation and production abuse controls before opening a new deployment. No schema, credentials or hosting configuration were changed by the repository cleanup.
