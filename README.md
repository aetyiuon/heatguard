# HeatGuard

Heat awareness, early cooling breaks and route planning for North Texas.

**[Open the live app](https://heatguard-tan.vercel.app/)** · [Documentation](#documentation) · [Contributing](docs/contributing.md)

Built with **TypeScript, React Native and Expo** for web, iOS and Android. The live web app is available now; signed native builds and physical-device acceptance remain pending. Development includes substantial assistance from Codex and Claude.

## Explore the app

| Tab        | What it does                                                                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today      | Current weather, shade heat index, separate official NWS HeatRisk and personal concern, early-break guidance, optional check-in and Groq explanation.          |
| Relief Map | City-first maps for Arlington, Dallas and Fort Worth, Dallas County, district portions, combined records, search, clustering and candidate directions.         |
| Journey    | Route sketches or mapped trail sections, explicit route-weather checks and relief-gap review. Foreground GPS is implemented but still needs device acceptance. |
| Forecast   | Seven-day outlook and hourly heat-index comparison.                                                                                                            |
| Community  | Optional coarse-location reports and a private contact/SMS-composer flow. Messages are never sent automatically.                                               |
| My plan    | Optional personal factors, language and larger-text controls, privacy settings and local-data deletion.                                                        |

The interface supports English and Spanish, a navy/mint glass theme and desktop/mobile layouts. Browser maps support wheel zoom and drag. **Route to nearest AC** finds a mapped candidate for review before opening Google Maps directions; it does not confirm open hours or working AC.

## Important limits

- **Adults 18+ launch policy.** HeatGuard supports awareness and early cooling breaks. It does not diagnose illness, predict heat stroke or guarantee safe time outside. Symptoms override timers.
- Weather is labeled by source and acquisition time. Missing values stay unavailable; stale/invalid conditions block starting a new activity timer. Below-threshold days correctly show that timed cooling breaks are not needed.
- Pins are dated public-source candidates with incomplete coverage. Parks are not proof of shade; libraries are not designated cooling centers. Route sketches and proximity distances are straight-line geometry, not walking directions or verified access.
- Private profiles/check-ins/contacts use encrypted native storage and browser memory. Ordinary weather requests exclude health entries. Optional personal AI separately sends reviewed factors to the HeatGuard server and Groq after consent; AI never sets minutes. Community sharing is a separate opt-in.
- Apple Health/Watch, native notifications, background execution and GPS accuracy require signed builds and physical-device testing. The browser does not simulate them.

## Run locally

Use **Node 24+** and **pnpm 11+** with the committed lockfile.

```sh
pnpm install
cp .env.example .env
cp .dev.vars.example .dev.vars
pnpm proxy
# In another terminal:
pnpm web
```

PowerShell: use `Copy-Item .env.example .env` and `Copy-Item .dev.vars.example .dev.vars`. Open `http://localhost:8081`; the API runs on port 8787. The default public heat-check preset is **Arlington · River Legacy Park**. Map browsing does not change that location.

Keep provider keys in server-only settings. Example files contain placeholders. For a phone, configure `EXPO_PUBLIC_API_URL` with the computer's LAN address; use HTTPS for distribution. Android native maps need a restricted public Google Maps SDK key; iOS uses Apple Maps and web uses Leaflet/OpenStreetMap. See the native testing guide before building.

```sh
pnpm typecheck
pnpm test
pnpm export:web
# Shared/native client changes also require JS/Hermes exports:
pnpm exec expo export --platform all --output-dir work/platform-check
```

Exports do not verify signed native binaries, Swift compilation, watch data or hardware behavior. See the [verification record](docs/verification.md) for checks actually run.

## Project layout

| Path                                         | Responsibility                                                                         |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `App.tsx`, `src/screens/`, `src/ui/`         | Navigation, screens, shared theme and platform renderers.                              |
| `src/domain/`, `src/state/`, `src/services/` | Risk/route/session logic, application state and platform services.                     |
| `api/`, `backend/`                           | Vercel entry point, weather/relief/AI handlers and optional Worker adapter.            |
| `src/data/`, `scripts/`                      | Dated public map snapshots, licensed geometry tools and refresh collectors.            |
| `supabase/`                                  | Community function and PostgreSQL schema; distinct from the optional Worker/D1 schema. |
| `modules/`, `watch/`                         | Local iOS HealthKit module and Watch companion source.                                 |
| `tests/`                                     | Domain, API, privacy, geography and lifecycle regressions.                             |

## Documentation

| Guide                                          | Contents                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| [Contributing](docs/contributing.md)           | Production branch, Codex/Claude collaboration and handoff template.       |
| [Methodology and privacy](docs/methodology.md) | Weather sources, risk policy, check-ins, storage and notification limits. |
| [Maps and datasets](docs/maps.md)              | Scope, source provenance, dated coverage and refresh commands.            |
| [Journeys](docs/journeys.md)                   | Planning, route weather, foreground recording and geometry limits.        |
| [AI](docs/ai.md)                               | Optional Groq inputs, consent, provider contract and privacy.             |
| [Deployment](docs/deployment.md)               | Vercel/Supabase hosting and optional Cloudflare Worker setup.             |
| [iPhone testing](docs/iphone-testing.md)       | Mobile-web preview and native testing prerequisites.                      |
| [Apple Watch](docs/apple-watch.md)             | Native module, signing and required device acceptance.                    |
| [Verification](docs/verification.md)           | Current release evidence, QA safeguards and remaining gaps.               |

Map-source attribution remains attached to records; OpenStreetMap data is [© contributors, ODbL](https://www.openstreetmap.org/copyright). Vendored geometry licenses remain in `scripts/vendor/`.
