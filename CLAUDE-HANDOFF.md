# UI handoff — October 24, 2026

Continue from branch **`codex-fix-nearest-ac-directions`** and PR **#1**, rather than the older `main` UI. This branch consolidates the local cooling-route, live-weather, personal-check-in, glass-theme, city-map and journey work. Read `AGENTS.md` and `COLLABORATION.md` first; the user's next UI request takes precedence over older style preferences.

Current presentation: navy/mint glass surfaces, simple amber sun logo, shared press-down buttons, desktop sidebar and six phone tabs. Start with `App.tsx`, `src/ui/theme.ts`, `src/ui/glass.tsx`, `src/ui/components.tsx`, `src/ui/RaisedPressable.tsx` and affected screens. Keep platform-specific glass/map files in view. English and Spanish are supported.

The app now has automatically refreshed current weather, a private personal check-in, nearest-AC candidate review, city-first Dallas/Fort Worth/Arlington relief maps, nested 119th-Congress district portions, and Journey planning/foreground GPS recording. All mapped entries currently combines 1,976 published records. Read `JOURNEYS.md`, `DFW-MAP.md`, `APPLE-WATCH.md` and `VERIFICATION.md` for actual behavior and gaps.

UI work should preserve the underlying freshness/symptom gates, source dates, candidate/unknown facility status and the distinction between cooling-break estimates and a guaranteed safe exposure time. Do not fabricate route directions, relief coverage, health measurements or a wearable connection to make a screen look complete. Sketches are straight lines; GPS pauses when hidden; route/pulse data stay in memory. Route weather checks deliberately bypass the persistent weather cache.

Apple Health / Watch bridge and companion source are included. The Watch target still needs Xcode integration, signing and device acceptance; the browser disables connection. JS exports do not establish Swift compilation or real Watch/GPS acceptance.

Validation before handoff: TypeScript passed; all 122 tests passed; affected twelve tests passed again after separating uncached route weather; final web/iOS/Android JS/Hermes exports passed. Browser checked desktop and 375×812, a real River Legacy connected trail and three-point weather analysis, public-coordinate sketch/undo, city/district filters and combined entries. No actual user GPS/pulse was captured.

Suggested next prompt:

> Read AGENTS.md, CLAUDE-HANDOFF.md and VERIFICATION.md on codex-fix-nearest-ac-directions. Inspect the current diff before editing. Rework the UI according to my instructions while preserving the existing heat logic, map provenance, local privacy and truthful wearable states. Use a separate branch for the UI work, test affected flows on phone and desktop, and leave a concise handoff.
