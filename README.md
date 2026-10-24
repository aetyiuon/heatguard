# HeatGuard

A working Expo / React Native scaffold for iOS, Android and browser review. Its purpose is early cooling breaks and heat awareness. It does **not** predict time to heat stroke, provide a diagnosis, or guarantee a safe exposure duration.

The shared UI uses rounded type, colorful cards, an original sun character, and raised buttons, filters, and navigation that press into their bases on click or tap. The same components support web, iOS, and Android.

In the browser preview, hover over a map and use the mouse wheel to zoom; click and drag to pan.

## Nearest AC directions

On Today, **Route to nearest AC** searches available downloaded/saved records within 10 km of the selected heat-check location, then tries the nearby API if no usable cooling candidate is found. It shows progress and an explicit unavailable/no-result message. A result displays the closest mapped candidate and straight-line distance; it is not a complete inventory or confirmation of opening hours, public access, or working AC. Review the destination, then tap **Open Google Maps directions** for a walking route from the selected heat-check location. This separate tap also avoids opening Maps after an asynchronous lookup, which browsers may block. Changing the heat-check location clears the previous result.

## Contributing with Codex or Claude

Read [COLLABORATION.md](COLLABORATION.md) for the branch workflow, reusable task prompt, and handoff template. [AGENTS.md](AGENTS.md) contains the shared project instructions; [CLAUDE.md](CLAUDE.md) imports them for Claude Code. Keep concurrent tasks in separate clones/worktrees and share changes through branches and pull requests.

## Run locally

For the saved free iPhone testing steps, see [IPHONE-TESTING.md](IPHONE-TESTING.md).

Use Node 24 or later and pnpm 11 or later. The committed lockfile pins dependencies.

```sh
pnpm install
cp .env.example .env
cp .dev.vars.example .dev.vars
pnpm proxy
# In another terminal:
pnpm web
```

On Windows use `Copy-Item .env.example .env` and `Copy-Item .dev.vars.example .dev.vars` in PowerShell. Open `http://localhost:8081`. New installs use **Arlington · River Legacy Park** for manual heat checks, with no invented weather. Choose a location or enter coordinates and tap **Check now**. GPS is optional. **Relief Map** now opens **Texas District 30** for the 119th Congress, with Dallas/Tarrant county portions and 19 searchable community portions. District 6, Entire Arlington, and Entire Dallas remain available. Map browsing does not change the heat-check location. Existing installations keep their saved heat-check location.

Replace the proxy's `NWS_USER_AGENT` with an app identifier and real support contact before publishing. `AIRNOW_API_KEY` belongs only in `.dev.vars` or a Worker secret. Missing AirNow produces an explicit unavailable state, not an AQI of zero.

To use a phone, set `EXPO_PUBLIC_API_URL` to `http://YOUR_COMPUTER_LAN_IP:8787` during development; localhost on a phone points at the phone. Use HTTPS for distribution. Start Expo with `pnpm start` and use a native **development build** for notification/background testing:

```sh
pnpm android
# On a Mac with Xcode:
pnpm ios
# Or after configuring your EAS account/project:
npx eas-cli build --profile development --platform android
npx eas-cli build --profile development --platform ios
```

Android's native map uses Google Maps and needs a Maps SDK key restricted to your package and signing certificate in `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`. It is a restricted public SDK key, not a weather-service secret. iOS uses Apple Maps. Browser maps use Leaflet/OpenStreetMap without a key. The list view works independently of the map renderer.

## What is implemented

| Area       | Behavior                                                                                                                                                                                                                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Today      | Actual weather retrieval, official daily HeatRisk where available, clearly labeled heat-index fallback, personal concern, an estimated range to an early cooling break, transparent reasoning and source links                                                                               |
| Session    | Wall-clock countdown anchored to timestamps, hydration reminders, a timed cooling phase before resume, break logging, notification cancellation on end, re-planning when conditions change, foreground reassessment                                                                          |
| Relief Map | Dallas County, TX-30 and TX-06 boundaries, community/county filters, 36 / 19 / 89 searchable community portions, official park/trail layers and explicit incomplete fountain/shade coverage; full Arlington/Dallas modes; zoom clusters, search, nearby lookup, source dates, directions, local suggestions and unavailable reports |
| Forecast   | Seven-day high/low/UV, official per-day HeatRisk where available, hourly heat-index view; absent values remain absent                                                                                                                                                                        |
| Heat kit   | Activity quiz, condition-specific bilingual explanations, interactive checklist and up to five saved outfits                                                                                                                                                                                 |
| Community  | Encrypted native buddy contacts, SMS composer, explicit self-check-in logging, opt-in neighbor-area reminders, optional anonymous community backend, coarse feeling reports, official HeatRisk overlay when a current valid raster exists                                                    |
| My plan    | Optional encrypted native profile, category-only medication checklist, hydration/shade/water context, background opt-in, English/Spanish, large text and local-data deletion                                                                                                                 |
| Safety     | Bundled offline CDC/NIOSH symptom/first-aid guide, emergency calling, reusable disclaimer on risk screens; no waiting for a timer when symptoms appear                                                                                                                                       |
| Proxy      | Concurrent NWS/Open-Meteo/HeatRisk/AirNow requests, coverage fallback, bounded upstream cache, request coalescing, Cloudflare edge cache, coordinate validation, allowlisted CORS, timeouts and rate limits                                                                                  |

## Risk model and limits

The pure engine is in `src/domain/risk.ts`, independently tested. It implements NWS's preliminary heat-index calculation, Rothfusz regression and humidity corrections. Official **NWS HeatRisk 0–4 is never generated or personalized locally**. The badge is a daily forecast; the activity recommendation also considers current conditions and workload. Missing today's raster does not authorize reusing tomorrow's rating.

The work/rest lookup transcribes the [NIOSH 2017-127 sample schedule](https://stacks.cdc.gov/view/cdc/45850/cdc_45850_DS1.pdf). It uses **air temperature with sun/humidity adjustments**, not heat index or a made-up injury curve. Normal cells are mapped to a bounded app planning interval. Caution cells suppress numeric activity windows. The sample assumes fit, rested, hydrated adult workers under 40, normal clothing and perceptible air movement; it is not a general population guarantee.

Displayed ranges, concern escalation, low-wind handling and personal-factor caps are **explicit conservative HeatGuard policy**, not published personal tolerance limits. Factors can only increase concern in heat. Sex never changes minutes. BMI is only a coarse caution flag. Heat acclimatization does not negate environmental risk. Children in heat do not receive an occupational countdown. The in-app methodology screen distinguishes original source cycles from app policy.

WBGT is a **screening approximation**, not measured WBGT or validated Liljegren: Stull psychrometric wet bulb plus a simplified black-globe solar/wind energy balance. The assumptions are documented in code; it is never used to assign occupational work/rest minutes. Protective equipment, radiant surroundings, fluid restrictions and individual illness need an appropriate heat plan and professional input.

Data older than one hour, invalid/future timestamps, very high concern, unavailable water in heat and NIOSH Caution suppress the activity timer. Caches display their data time. Symptoms always take priority. Logging a break is not proof of physiological recovery.

## Notifications and background behavior

`expo-background-task` and `expo-task-manager` use Android WorkManager and iOS BGTaskScheduler. Monitoring is a **saved-place** check; there is no background GPS tracking. Requesting a 15-minute minimum interval does not guarantee that frequency. OS scheduling, connectivity, battery saving and force-quit can prevent alerts. Re-open the app and check conditions manually. Expo Go and simulators are not sufficient acceptance tests.

Android channels provide severity-specific vibration patterns; users and device settings can change delivery. iOS uses system sounds/haptics, with Time Sensitive interruption for high concern. User permission and Focus settings govern delivery. Time Sensitive does **not** override the Silent switch; no critical-alert entitlement or silent Do Not Disturb bypass is claimed.

Tapping a local notification opens the risk/community screen and refreshes conditions. Session notifications use the **lower end** of the range, and stop/reschedule as recommendations change. On the browser, the in-app timer works but there are no native background alerts.

## Weather provenance and usage

- [NWS API](https://www.weather.gov/documentation/services-web-api): points, hourly/daily forecast and active heat alerts. Hourly values are forecasts, not observations.
- [NOAA HeatRisk ImageServer](https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer): dated raster catalog, locked-raster point identification, raw numeric values, NoData handling.
- [Open-Meteo](https://open-meteo.com/en/docs): modeled current values, hourly humidity/wind/radiation/UV, daily forecast, global fallback. Current modeled conditions are labeled. Check licensing/commercial plan requirements before a commercial launch.
- [AirNow](https://docs.airnowapi.org): server-only registration key; optional regional AQI, observed time retained. No AQI means no air-quality conclusion.
- [NWS heat-index formula](https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml), [NIOSH prevention/hydration](https://www.cdc.gov/niosh/heat-stress/recommendations/), [CDC/NIOSH symptoms](https://www.cdc.gov/niosh/heat-stress/about/illnesses.html), [CDC medication guidance](https://www.cdc.gov/heat-health/hcp/clinical-guidance/heat-and-medications-guidance-for-clinicians.html), [Stull wet-bulb paper](https://doi.org/10.1175/JAMC-D-11-0143.1).

The four heat-index awareness tiers are historical OSHA guidance, **not** a claim about current legal work/rest requirements. The five-color green/yellow/orange/red/magenta legend is the official HeatRisk palette. Unknown HeatRisk is explicitly marked.

## Relief data and privacy

**Entire Dallas County** is now a separate Relief Map option, covering the full Census county boundary and 36 searchable community portions plus remaining county areas. Its October 23 baseline contains 1,213 amenity records, 684 park features and 862 trail features, including 29 Garland pavilion candidates and 673 NCTCOG existing off-street paths. Fountain/shade coverage outside Dallas city remains incomplete; records retain their source dates and unknown facility status. See [DALLAS-COUNTY-MAP.md](DALLAS-COUNTY-MAP.md) for sources, gaps and refresh commands. `/relief?county=dallas` serves the same snapshot. The existing city/district views remain available, and map browsing leaves the heat-check location unchanged.

**Texas Districts 30 and 6** use the current 119th Congress boundaries, distinct from the new 2026 election / 120th Congress maps. TX-30 contains 279 park features, 112 trail features, 531 amenity records, and 19 community portions; see [TX30-MAP.md](TX30-MAP.md). TX-06 contains 102 park features, 25 trail features, 104 amenity records, and 89 community portions; see [TX06-MAP.md](TX06-MAP.md). Source layers include Census, USGS PAD-US, TPWD, and dated DFW snapshots. Polygon and trail clipping keeps overlays inside each district. **Fountain/shade coverage is incomplete:** public Overpass providers timed out, so the catalogs explicitly report a baseline with 0/2 TX-30 and 0/20 TX-06 community-data sections completed. Zero records do not mean no amenities exist. `pnpm data:refresh:tx30` and `pnpm data:refresh:district` retry full TX-30 and TX-06 collection; the corresponding `data:tx30:baseline` and `data:district:baseline` commands explicitly rebuild the limited catalogs. `/relief?district=tx30` and `/relief?district=tx06` expose source and coverage metadata.

The Relief Map also offers **Entire Arlington**, **Entire Dallas** and **Near my selected location**. City maps use dated, bundled snapshots collected from real public APIs across each municipal boundary. They include every returned municipal park/trail record and eligible amenities, without the previous nearby radius or 300-result cap. Numeric clusters expand on zoom; every loaded amenity remains searchable and accessible in the paginated list. Park shortcuts and search results focus the map without changing the user's weather location. Distances remain measured from the selected heat-check location, which is named on screen.

The built-in [City of Arlington Parks Amenity GIS](https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer) adapter retrieves Drinking Fountain (1), Pavilion (16) and Trail (4) layers in WGS84. Fountain names retain park and asset IDs; inactive/retired assets, including IDs beginning `RETIRED`, are excluded. Pavilions use approximate footprint centers. Published record updates are displayed separately from retrieval time. City records verify the mapped feature type, **not** working water, today's shade or current access. Hike/bike and mountain-bike trails are drawn as context; emergency access and golf-cart paths are excluded. Trail geometry is not a routing or tree-canopy model.

Dallas park/trail data comes from the municipal sources linked by the [Dallas Trails Dashboard](https://www.dallasparks.org/149/Trails); planned trail segments are excluded. City boundaries retain polygons, islands and holes. Dallas fountain/shade markers use OpenStreetMap; Arlington adds municipal asset records. A park boundary itself is never marked as shade.

OpenStreetMap places are **unverified suggestions**. Only explicitly potable fountains/taps are water pins. Shelters and woodland tags provide shade evidence; a generic park is not automatically treated as shade. Woodland centers are approximate area markers, not shaded seats or guaranteed accessible entrances. Libraries are public cooling candidates, not confirmed open AC. Never imply an OSM pin is an official cooling center. Fort Worth and other nearby areas still use live OSM queries; those queries and Arlington's nearby adapter retain their smaller-radius limits. Overpass availability varies; bundled city data does not depend on that service when opened.

Run `pnpm data:refresh` to rebuild both city snapshots from the public sources. The script enumerates ArcGIS object IDs, fetches all batches, checks omissions, retrieves uncapped OSM sections across the city bounding box, deduplicates overlapping sections and filters OSM points to the actual municipal polygons. It rejects incomplete responses before replacing snapshots. Intermediate OSM sections are cached in the project's `work/city-raw` directory for one day. `/relief?city=arlington` and `/relief?city=dallas` expose the same dated datasets; the app loads them on demand from its bundle. **Reload city map** resets the view; it does not claim new upstream data. Geographic coverage spans both full cities, but no source establishes that every physical fountain or shady location has been mapped.

Confirm hours and access before walking. Distance and estimated walk time use straight-line geometry at 1 m/s; actual routes may be longer and obstacles are not evaluated. The directions provider handles routing. Map labels avoid overlap in the browser; zoom or tap a marker for its name and source. Lists provide full labels independently of the map. See `DFW-MAP.md` for the local map demo and coverage.

Set `MUNICIPAL_GEOJSON_URL` to a curated, authoritative city/county **Point FeatureCollection**. Normalize properties as follows:

```json
{
  "id": "stable-id",
  "name": "public place name",
  "kind": "cooling-center",
  "source": "city/county department",
  "sourceUrl": "https://authoritative-source.gov/page",
  "official": true,
  "active": true,
  "verifiedAt": "ISO timestamp",
  "status": "working",
  "openingHours": "published hours"
}
```

Supported `kind`: `water`, `shade`, `ac`, `cooling-center`. Only a configured authoritative feed with explicit official/active flags, a source URL and verification in the past seven days gets the official badge. The bundled city records are real published data, not fabricated cooling centers. Add authoritative cooling-center or measured canopy sources as available.

Forecast and nearby place metadata are cached locally per area. Full Arlington/Dallas geometry, amenity lists, search, saved pins and the symptom guide are bundled and work without a live data lookup. The basemap still needs network tiles, and browser Leaflet needs its CDN script; no offline tile-download rights are assumed. Retrieval dates do not assert that a place is open now. Local unavailable reports replace remote pins so a flagged location is excluded from suggestions.

Native optional profile and buddy data use SecureStore, with device-only Keychain accessibility after first unlock to permit background reads. There is no health-data synchronization, telemetry or analytics. Weather APIs see the chosen location, and basemap providers receive tile requests. The **browser stores health and contacts only in memory** because browser local storage cannot promise native encryption. Reload clears them.

## Deploy the proxy and optional community backend

The weather proxy works without D1. Configure `ALLOWED_ORIGINS` for exact web origins, a real NWS contact, HTTPS and optional secrets; then run:

```sh
pnpm deploy:proxy
npx wrangler secret put AIRNOW_API_KEY
```

Community POST endpoints deliberately return 503 until **both** D1 and `COMMUNITY_SALT` are configured. Create a D1 database, set the binding in `wrangler.toml`, apply `backend/schema.sql`, and set a random secret salt:

```sh
npx wrangler d1 create heatguard-community
npx wrangler d1 execute heatguard-community --remote --file backend/schema.sql
npx wrangler secret put COMMUNITY_SALT
```

Public pin suggestions require separate in-app consent. Heat feeling reports round location to about 1 km. Profiles/contact names/phones never go to these endpoints. A salted anonymous installation hash deduplicates confirmations/flags. Three independent flags demote a pin; reports disappear from maps after six hours and old pins after 30 days. Expired rows remain in storage until you add a retention cleanup job. Configure the optional shared rate-limit binding and production abuse/moderation controls before accepting public traffic. This scaffold does not claim that anonymous IDs are authenticated users or that votes establish safety.

Buddy reminders notify **this phone**. SMS opens a composer; the user sends. Automatic alerts to a buddy after a missed check-in require a separate consent-based messaging service and delivery monitoring. No messages are sent automatically by this scaffold.

Apple Health / Android Health Connect and numeric historical climate-normal comparisons are documented extension boundaries, not live integrations. `src/services/health.ts` never fabricates heart-rate samples. Implement native permissions and validated adapters before enabling these optional features.

## Validate

```sh
pnpm typecheck
pnpm test
pnpm export:web
npx expo install --check
```

See `VERIFICATION.md` for completed checks and the physical-device acceptance matrix. Native builds/signing, real vibration/Focus behavior, AirNow with your key, configured municipal feeds, D1 writes and buddy-message delivery require your actual deployment or device. No app-store publishing or cloud provisioning was performed.
