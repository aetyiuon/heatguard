# Gemini city outlook

HeatGuard is for adults 18+. The entry screen requires an age affirmation before the app state/network hooks mount. This is self-attestation, not identity verification. No birth date is collected. The optional profile accepts adult ages only. The AI feature separately requires an explicit sharing choice, defaults off, and makes no background requests.

## What AI does

Today has a **Gemini / City outlook** card. Choose Arlington, Dallas or Fort Worth. Gemini explains fresh public city-center weather in English or Spanish and prioritizes a fixed planning checklist. The response is actual model generation, not a canned success message. Its card shows the weather reading, sources, generation time and model. City weather can differ from the user's journey. It does not inspect or optimize an individual route.

Gemini does **not** calculate outdoor minutes, diagnose illness, assess personal physiology, change timers, or override stop warnings. Existing local calculations remain responsible for those checks. Generated prose is fallible; schema/keyword checks are not medical or factual validation. Symptoms or stale/unavailable local weather suppress the AI card's result and generation button. A result expires after at most ten minutes, earlier if its weather expires. Changing city, language or consent clears the result and cancels the client request. Navigating away does not persist the result.

## Privacy boundary

The only accepted request is `POST /api/ai/outlook` (or `/ai/outlook` on the local proxy):

```json
{ "city": "arlington", "language": "en", "adult": true, "consent": true }
```

All four fields are required. Unknown fields and query strings are rejected before upstream calls. There is no free-text input. The server obtains weather at a fixed, public city-center coordinate; it never accepts the user's GPS position. Only the city's name, language, selected public weather fields and a generic map-coverage caveat are submitted to Google. Adult/consent flags are checked locally by the server, not forwarded. Profiles, conditions, medications, symptoms, hydration, measurements, wearable data, names, contacts, user identifiers, custom pins, route coordinates and derived personal risk are excluded. Do not add these to free-tier requests, even with consent.

Google's [Gemini terms](https://ai.google.dev/gemini-api/terms) prohibit personal/sensitive/confidential inputs to unpaid services and prohibit clients directed toward or likely to be used by under-18s. Free-tier prompts and responses may be used to improve products, including human review. HeatGuard discloses this before requesting consent. The current Vercel integration restricts AI requests to US visitors using Vercel's trusted country header; missing or non-US production geo headers fail closed. Do not remove this guard without reviewing Google's region and paid-service requirements. A school account may have AI Studio disabled by its administrator; do not bypass organizational restrictions.

No AI request/response logs, database tables, telemetry events, chat history, personal prompts or persistent AI response storage are added. There is no Supabase change. Public responses are held in bounded server memory and expire; HTTP responses use `Cache-Control: no-store`. The provider sees the server's request, not client identifiers or headers. The app's existing weather/map services still receive their previously documented inputs.

## Server configuration

- `GEMINI_API_KEY`: private server environment variable. Local development: ignored `.dev.vars`. Vercel: project **heatguard**, Secret type, **Production** target. Add Preview only if explicitly needed. Never use `EXPO_PUBLIC_`, commit a key, put it in a URL or log it.
- `GEMINI_MODEL`: optional; defaults to the reviewed free-tier text model `gemini-3.5-flash-lite`. Other values deliberately disable this integration until reviewed. No paid or alternate-model fallback.
- Deploy again after adding/changing the key. `/api/health` reports `ai: true` when configured; that is configuration status, not proof the credential/provider works.
- Use a dedicated key/project with billing unlinked for a free-only setup. The application cannot determine a Google project's billing tier from its API key. Linking billing can make otherwise identical calls billable. The app never enables billing or upgrades a plan.

The implementation uses Google's supported [generateContent REST structured output](https://ai.google.dev/gemini-api/docs/generate-content/structured-output), with the key in the `x-goog-api-key` header, a JSON schema, no tools/search, a token cap and a twenty-second provider timeout. No additional SDK dependency is required. [Published pricing](https://ai.google.dev/gemini-api/docs/pricing) lists free-tier text for the default model as of October 25, 2026; model access and quotas vary by account and can change.

## Failure and cost controls

The configured Google project is `heatguard-512707` (HeatGuard). Google AI Studio reports **Free tier unavailable**, and the corrected production inference request returned `access-denied` rather than generated content. The replacement key is stored only as a Vercel Production Secret; billing remains unlinked. Google's [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting#project-restricted-or-unavailable) says free-tier eligibility is evaluated at project/account level and changing keys does not resolve this restriction. Do not create replacement projects/keys to evade it, claim that AI is producing live answers, or enable paid billing without the owner's explicit decision. A configured-key health check alone is not a successful inference check.

Input is capped at 256 bytes. The AI route has its own five-requests-per-minute per-IP limit and a best-effort thirty-generation-per-day **per server process** bound, in addition to the app's general request limit. Public results are shared for at most ten minutes by city/language and simultaneous matching requests coalesce. These memory limits are not a distributed/global spending cap: serverless instances and restarts have independent counters. Google account quotas are authoritative. No key rotation, retries, quota evasion or paid fallback is implemented. For a wider launch, use centrally enforced quotas/authentication before raising capacity.

Missing/invalid credentials, quota exhaustion, stale weather, provider refusal, timeout, malformed JSON, unsupported checklist actions or rejected prose produce an explicit unavailable state. Provider error bodies and credentials are never returned. There is no simulated AI fallback. Local weather, map, check-in, journey and timer tools continue working.

## Contributor handoff

Base: `codex/deploy-live` at `1f4b9ce8b175cc396241b7aebb3b0bb1f789442e`. Work in a feature branch and target `codex/deploy-live` in its PR. Read `AGENTS.md` and `COLLABORATION.md`. Preserve the navy glass UI and both languages. Keep the explicit request projection in `src/ui/AiOutlook.tsx`, strict `src/domain/ai.ts` contract, and server-only provider code in `backend/ai.ts`. Changing safety algorithms or sending private inputs is outside this feature. Real provider verification needs a configured key; tests use public fixtures and mocked provider responses, never a real user's health data.
