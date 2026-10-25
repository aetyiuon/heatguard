# AI city outlook — Groq

The current integration uses **Groq**, with the production model **`openai/gpt-oss-20b`**, through its HTTPS Chat Completions API. GPT-OSS is the model name; this does not use an OpenAI API key or an OpenAI account. The previous direct Gemini path was blocked by Google's project eligibility decision and is no longer called. There is no provider/model fallback, fake generated answer, or automatic paid upgrade.

## User flow

HeatGuard remains adults-only (18+) by the owner's decision. Entry uses self-attestation, without collecting a birthday or identity document. Today has an optional **AI / City outlook** card. Select Arlington, Dallas or Fort Worth, read the Groq data notice, and choose whether to send a request. Consent defaults off and is not persisted. There are no automatic AI requests or background chat history.

The model explains fresh public city-center weather in English or Spanish and prioritizes a fixed planning checklist. The card shows the original weather reading, source names, generation time, provider and exact model. City-center conditions can differ from a journey. No private route is inspected, optimized or sent to the provider.

AI does not calculate outdoor minutes, diagnose illness, assess physiology, change timers, or override stop warnings. Existing local checks retain those responsibilities. Generated prose is fallible; structural/keyword validation is not medical or factual validation. Stop warnings or stale/unavailable local weather suppress both generation and displayed AI results. Results expire after at most ten minutes, earlier if their source weather expires. City/language/consent changes clear results and cancel the client request. Navigating away keeps no AI result history.

## Complete request contract

`POST /api/ai/outlook` on Vercel, or `/ai/outlook` on the local proxy:

```json
{ "city": "arlington", "language": "en", "adult": true, "consent": true }
```

All fields are required. Unsupported values, unknown fields, private inputs, query strings and oversized requests fail before any provider call. The hosted adapter removes only Vercel's exact public route capture; duplicated, mismatched and unrelated query data remain rejected. There is no free-text prompt field.

The server fetches public weather at a fixed city-center coordinate. Groq receives only city name, language, selected public weather fields and a generic map-coverage caveat. Adult/consent flags are checked by HeatGuard and not forwarded. User GPS, route coordinates, profile, medical conditions, medications, symptoms, hydration, wearable data, measurements, contacts, private pin labels, user identifiers and derived personal risk are excluded. Never spread app state into a provider request.

Groq's [data documentation](https://console.groq.com/docs/your-data) says inference content is not retained by default, with exceptions for reliability troubleshooting/abuse review and persistence features. Reliability/abuse logs can be retained for up to thirty days; account admins can enable Zero Data Retention. Usage metadata is separate. The app describes provider processing before opt-in and links the data policy. Do not imply this is a healthcare data agreement or send PHI; review the [Services Agreement](https://console.groq.com/docs/legal/services-agreement) and [AI policy](https://console.groq.com/docs/legal/ai-policy) before expanding scope.

No AI logs, database tables, telemetry events, chat history or persistent response storage are added to HeatGuard. Supabase is unchanged. Public responses are cached only in bounded server memory and use HTTP `Cache-Control: no-store`. The provider receives the server's request, not client identity headers. Existing weather/map/community privacy boundaries still apply.

## Server configuration

- `GROQ_API_KEY`: server-only key. Use ignored `.dev.vars` locally or a Vercel **Production Secret** for project `heatguard`. Never use `EXPO_PUBLIC_`, source code, URLs, shell arguments/history, screenshots or logs for a real key. Only add Preview access deliberately.
- `GROQ_MODEL`: optional; defaults to `openai/gpt-oss-20b`. Unreviewed model values disable AI. Preview Qwen models and other providers are not automatic fallbacks.
- Deploy after adding/changing server configuration. `/api/health` returns `ai` (configuration status) and `aiProvider: "groq"`; it is not a provider success test. Verify a real opt-in generation.
- Keep the account on **Free** with no payment method or upgrade. The key itself does not reveal the account's billing plan; moving it to a paid plan can make usage billable. The app never adds a card, enables billing or buys credits.
- Old `GEMINI_API_KEY`/`GEMINI_MODEL` variables do not enable AI and are not read. Removing an obsolete credential is a separate owner-managed cleanup, not a prerequisite for Groq.

The integration uses [Groq strict structured output](https://console.groq.com/docs/structured-outputs): `response_format.json_schema`, all required fields, no extra properties, a short token cap, low reasoning effort, no tools/search, and a twenty-second provider timeout. The response must identify the expected model, finish normally, contain no refusal, and pass runtime checks. Reasoning fields and raw provider errors are never displayed or returned. No SDK/dependency change is needed.

## Free allowance and failure handling

Groq's [published limits](https://console.groq.com/docs/rate-limits) list a Free plan for the selected model, with request and token limits at the organization level. The actual signed-in account's limits are authoritative. A published allowance does not guarantee signup or capacity. Production status is distinguished from preview/evaluation models in the [model catalog](https://console.groq.com/docs/models).

HeatGuard caps AI input at 256 bytes, allows five requests per minute per IP, coalesces concurrent city/language requests, and caches public answers for at most ten minutes. A best-effort thirty-generation-per-day limit is **per server process**, not a distributed or global spending cap. Serverless instances/restarts have independent counters. Provider quotas remain authoritative. No automatic retries, credential rotation, quota evasion, credit purchases or paid fallback are implemented.

Missing/invalid keys, denied access, quota exhaustion, stale weather, timeout, refusal, truncation, wrong-model responses, invalid JSON, unsupported actions and rejected prose produce explicit unavailable states. They do not become canned AI success. Weather, map, local check-in, journey and timer features continue working.

The initial hosted AI rollout remains US-only using Vercel's trusted country header; missing/non-US production country headers fail closed. This is a retained launch policy, not a claim that Groq has Gemini's region rules. A region expansion requires a deliberate review.

## Verification and contributor handoff

Base: `codex/deploy-live` at `da8fbb3b5c4dff09b8f68b06883dee7e3fcb584a`. Feature branch: `codex/groq-live-ai`. Follow `AGENTS.md` and `COLLABORATION.md`; target `codex/deploy-live` in the PR and preserve contributor history.

Provider tests use synthetic public weather and mocked Groq responses, never actual health entries. They cover private-input rejection, Bearer-key transport, strict schema settings, source freshness, expiry/coalescing, sanitized failures, expected-model/refusal/truncation checks, routing captures and legacy Gemini rejection. Live provider/browser verification requires a configured Groq key; report it separately from unit checks and native JavaScript/Hermes exports. See `VERIFICATION.md` for the actual release outcome.
