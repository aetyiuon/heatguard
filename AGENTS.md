# Shared instructions for HeatGuard contributors

These repository instructions apply to Codex, Claude Code, and other coding assistants. Keep shared rules here; `CLAUDE.md` imports this file. Follow the user's current task and applicable higher-priority instructions. Read [COLLABORATION.md](COLLABORATION.md) for the branch workflow and handoff template.

## Start with the current checkout

- Read [README.md](README.md) for setup and behavior, and the relevant sections of [VERIFICATION.md](VERIFICATION.md) for tested behavior and known gaps. Inspect the affected implementation before editing; chat history and private agent memory are not shared project state.
- In a Git clone, inspect `git status --short --branch`, the current diff, and recent commits. Confirm the repository root before Git mutations. A downloaded source folder might have no `.git`; do not accidentally commit to a parent repository or initialize Git without a reason.
- For concurrent tasks, use separate clones or worktrees and a branch per task. Agree on file ownership through the task/PR; do not run independent agents against the same working directory. Preserve unrelated and uncommitted changes.
- Keep changes focused. Avoid unrelated rewrites, bulk formatting, dependency upgrades, and data refreshes. Before touching a file that changed upstream, read the new diff and reconcile intent; never resolve conflicts by discarding the other contributor's work wholesale.
- Finish with a reusable handoff containing the branch/base commit, purpose, changed files, actual checks, limitations, and next step. Use the PR description or paste the template into the next chat. Do not rely on an agent remembering another agent's conversation.

## Project map and setup

Use Node 24+ and pnpm 11+ with the committed `pnpm-lock.yaml`. See README for environment setup. Run `pnpm proxy` for the API on port 8787 and `pnpm web` for Expo on port 8081 in separate terminals. On phones, the API URL needs the computer's LAN address rather than localhost; see [IPHONE-TESTING.md](IPHONE-TESTING.md).

| Location                    | Responsibility                                                         |
| --------------------------- | ---------------------------------------------------------------------- |
| `App.tsx`, `src/screens/`   | App shell, navigation, and screens                                     |
| `src/ui/`                   | Shared theme, controls, and platform-specific map renderers            |
| `src/state/useHeatGuard.ts` | App state and screen/data coordination                                 |
| `src/domain/`               | Types, pure risk/session/relief logic, and source references           |
| `src/services/`             | API client, storage, monitoring, and health integration boundary       |
| `backend/`                  | Weather/amenity proxy, local server, Worker, optional community schema |
| `scripts/`, `src/data/`     | Data collectors/geometry and generated map snapshots                   |
| `tests/`                    | Domain, API, geography, and data regression tests                      |

Use existing TypeScript patterns and format only changed files with `pnpm exec prettier --write <files>`. Keep API payloads and domain types consistent across client and backend. Retain vendored licenses. Change Expo/native dependencies deliberately with their compatibility requirements; an unrelated task is not an SDK migration.

## Product and UI conventions

- HeatGuard supports iOS, Android, and web. Check platform-specific files when editing shared behavior.
- Preserve the friendly rounded green/blue/yellow style and original sun character. Reuse `theme.ts`, shared components, and `RaisedPressable` for the press-down effect without layout shifts. Keep keyboard focus, disabled semantics, touch targets, and large-text support.
- English is the default; preserve Spanish support and update both language strings when changing localized copy.
- Preserve real interactive maps: web Leaflet supports mouse-wheel zoom and drag panning; native renderers differ. Map browsing must not silently change the saved heat-check location.

## Heat information and privacy

- This app supports heat awareness and early cooling breaks. Do not describe it as diagnosing illness, predicting time to heat stroke, or guaranteeing a safe exposure duration.
- Read `src/domain/risk.ts`, its tests, and the methodology before changing heat calculations or recommendations. Keep official NWS HeatRisk separate from the app's personalized concern rating. Preserve source references and distinguish published guidance from app policy.
- Missing readings are unavailable, not zero or invented values. Preserve stale/future-data handling and timer suppression. Symptoms take priority over timers. Never imply that logging a break proves recovery.
- Keep weather/provider secrets on the server in local `.dev.vars` or deployed secrets. `EXPO_PUBLIC_*` values ship to users; they are unsuitable for private credentials. A restricted public map SDK key is a different case.
- Never commit real `.env`/`.dev.vars` files, credentials, signing material, precise user locations, health/profile/contact data, or private logs. Maintain placeholder-only example files and `.gitignore` exclusions.
- Preserve local privacy boundaries, opt-in community behavior, and explicit user review in the SMS composer. Do not add automatic messaging or send health/contact details to proxy telemetry. Notifications/background execution depend on the OS and require device testing.

## Map data integrity

- Read [DFW-MAP.md](DFW-MAP.md), [TX06-MAP.md](TX06-MAP.md), or [TX30-MAP.md](TX30-MAP.md) for the affected dataset. Keep provenance, timestamps, coverage warnings, and unknown/unverified status visible.
- District snapshots currently use the 119th Congress (2025-2027) boundary vintage. Do not silently replace it with election boundaries or a later Congress. Treat a boundary migration as an explicit data/version change.
- Use the refresh scripts rather than inventing pins or hand-editing generated snapshots. Preserve the previous snapshot on failed collection. A baseline collection is incomplete; an empty result does not establish the absence of amenities.
- Parks are not automatically shade, decorative fountains are not drinking water, and libraries are not automatically designated cooling centers. Preserve distinctions between candidate records and verified working facilities.
- Clip features to actual district/city polygons, including holes and islands, rather than bounding boxes. Keep crossing trails correctly clipped. Source feature counts can include overlapping records and must not be presented as a complete count of unique physical facilities.
- When extending a dataset/scope, update its collector, types/loader, API validation, UI selection, regression tests, and documentation together.

## Verification and delivery

- For TypeScript or behavior changes, run `pnpm typecheck` and relevant tests; use `pnpm test` for shared logic, API, or data changes. Add meaningful regression coverage for new logic, not tests that only repeat styling values.
- For web UI changes, run `pnpm export:web` and inspect the affected flow when browser access is available. For shared/native UI or dependency changes, also export iOS and Android, for example `pnpm exec expo export --platform ios --output-dir work/ios-check` and the corresponding Android command.
- Documentation-only edits need link/content checks, not an app rebuild. If a check cannot run, report why and what remains unverified. Never claim tests passed without executing them.
- JavaScript/Hermes exports are not signed native builds, physical-device tests, or proof of notification/background behavior. Keep these claims distinct in handoffs and `VERIFICATION.md`.
- Review the final diff for unrelated files and secrets. Update relevant documentation when behavior or data contracts change, and record material validation results. Do not rewrite old verification entries as though new tests ran on those dates.
- Follow the team's branch/PR workflow. Do not force-push shared branches, overwrite another contributor's commits, or merge/deploy outside the user's authorized task. Routine reversible implementation work does not require a new approval step.
