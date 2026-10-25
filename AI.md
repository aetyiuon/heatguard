# AI planning context — Groq

HeatGuard uses Groq Free with production model `openai/gpt-oss-20b`. Gemini is retired. There are no paid upgrades, automatic retries or provider fallbacks.

## Personal inputs

Adults can choose city-only weather explanations or explicitly include their own optional saved profile and latest check-in. Personal mode shows every field before transmission: age, height, weight, optional sex, fitness/acclimatization, prior and current hydration, condition and medication categories, shade/water access, activity/workload, feeling, clothing, and optional pulse/temperature with context, measurement method and timestamps. Unknown values stay missing. Actual metabolism is not measured or inferred from body size/pulse; activity is a workload proxy. Wrist temperature is not core temperature. No wearable history is sent.

Use My plan and Add/Update my check-in to enter/edit values, then Today → Include my personal inputs. Review the complete snapshot, read the sensitive-data notice, consent and press Explain my planning factors. Personal sharing and consent default off. Changes to the reviewed snapshot, city or language revoke consent and clear/cancel old results. Navigating away retains neither AI results nor AI consent. Personal stop warnings and stale weather/check-ins disable generation. The server independently rechecks personal stop rules against fresh public city weather before forwarding personal factors to Groq. The local profile/check-in is transmitted to HeatGuard’s server for validation; it is not forwarded to Groq on a rejected request.

The model receives the reviewed factors for an informational preparation explanation and prioritizes a fixed checklist. AI does not diagnose, interpret clinical readings, recommend medication changes, assign/extend outdoor minutes, alter timers or override stop warnings. Numeric exposure decisions remain in the existing local engine, which is conservative app policy and not validated individual heat-tolerance prediction. A normal pulse, temperature or body size never earns extra minutes.

## Privacy and provider scope

Personal mode shares sensitive wellness entries with HeatGuard’s server and Groq. It is a material change from the original city-only feature and requires its own explicit in-app choice. No names, contact details, account/device identifiers, GPS, routes, free text, clinical records or wearable histories are accepted. Only reviewed allowlisted category IDs and bounded numbers are supported. This is a consumer wellness explanation, not clinician care or a clinical-record service. Do not treat user consent as a healthcare agreement or accept protected health information: Groq’s [Services Agreement](https://console.groq.com/docs/legal/services-agreement) restricts PHI without an applicable BAA and prohibits High Risk Activities. Reassess provider suitability before any clinical use or high-impact medical decision feature; the current app has no healthcare agreement with Groq.

Groq’s [data policy](https://console.groq.com/docs/your-data) says inference content is not retained by default, with reliability/abuse exceptions up to thirty days unless legally retained longer, subject to account controls. Usage metadata is separate. The app discloses the provider before sharing and links the policy. Do not claim guaranteed zero retention or anonymity.

Personal requests/responses are never put in the shared city cache or coalesced across users, logged by app code, saved to Supabase or persisted as AI history. Their raw input remains in the request’s in-memory execution context only. The client retains an active result only in memory. All AI HTTP responses use `Cache-Control: no-store`. City-only mode continues to exclude personal data and uses its separate bounded public cache.

## Request and output contracts

`POST /api/ai/outlook` on Vercel (`/ai/outlook` locally) accepts exactly:

```json
{ "city": "arlington", "language": "en", "adult": true, "consent": true }
```

Personal mode additionally requires both `personalConsent: true` and `personal: {profile, checkIn, workload}`. See `src/domain/aiPersonal.ts` for the exact projection/allowlists. Missing required categories, extra nested fields, unsupported values, invalid/future/old check-ins, query data and bodies over 4 KiB fail closed. Optional measurements retain acquisition times; no missing measurement is replaced with zero. No raw real-user examples belong in tests or docs.

The server fetches fixed public city-center weather, not user GPS. It supplies public source fields and, only in personal mode, the strictly projected snapshot. The strict JSON schema allows qualitative prose plus two to four known action IDs. Server validation rejects wrong models, refusals, truncated/malformed responses, unexpected keys, numeric durations and safety assurances. This is not factual/medical validation. Personal output does not echo the raw profile/check-in; AI prose remains fallible. Results include city, language, `scope` (`city` or `personal`), public weather/time/sources, provider, model and expiry. Personal mode cannot reuse a city-only result in the UI.

## Server setup and limits

Use server-only `GROQ_API_KEY` as a Vercel Production Secret. Optional `GROQ_MODEL` defaults to the pinned model; other values disable the feature. Never use `EXPO_PUBLIC_*`, code, logs, screenshots or URL parameters for keys. Existing legacy Gemini variables are unused. Keep the provider account on Free; do not add cards or upgrade automatically. `/api/health` reports configuration, not generation success.

The retained hosted rollout is US-only and adults 18+; country gating fails closed on production. This is app launch policy. Strict structured output, low reasoning effort, a 1,536-token cap, a twenty-second provider timeout and no tools/search limit the provider request. Actual provider account quotas are authoritative. Five AI requests per minute per IP and a best-effort thirty-generation-per-day bound are process-local, not distributed spending controls. Only public city answers are coalesced/cached for up to ten minutes; personal requests always use isolated provider calls. Failed private requests never become canned successes.

## Contributor handoff

Personal feature base: `codex/deploy-live` at `9ab7e099ff5e4c7afb0043ec2cea180558461eaa`. Feature branch: `codex/personal-ai-inputs`. Target production `codex/deploy-live`, preserve other contributors and follow AGENTS.md/COLLABORATION.md. The user explicitly requested all supplied factors after agreeing that local calculation retains authority over minutes.

Tests use fictional wellness snapshots only. They verify separate consent, nested allowlists, explicit projection, all-factor model payloads, no raw-profile response echo, no personal cache/coalescing, unchanged city-only isolation, and stop rules before provider access. See VERIFICATION.md for actual checks and live/browser outcomes. Native exports do not establish signed builds, device acceptance or medical validity.
