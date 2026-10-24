# Dallas, Fort Worth and Arlington relief maps

The separate **Entire Dallas County** option extends beyond these city limits, with additional regional paths and Garland shelters. See [DALLAS-COUNTY-MAP.md](DALLAS-COUNTY-MAP.md) for its sources, counts and incomplete amenity coverage.

Relief Map now starts in **Arlington** and groups entries by **Dallas**, **Fort Worth** and **Arlington**, with **Full city map** and intersecting **District 6/30 portions** beneath each city. District boundaries retain their 119th Congress (2025–2027) vintage. Fort Worth intersects District 6 in this vintage. **All mapped entries** combines all existing city/county/district sources; it preserves source areas outside the three cities and offers secondary full-district views. Dallas County and Nearby remain separate choices. Search parks, trail names, fountain IDs and places; clusters expand into named markers. A park footprint does not imply shade.

## Fort Worth and city/district intersections — October 24, 2026

`scripts/refresh-dfw.ts` fetches the full Census BAS 2026 Fort Worth city boundary, enumerates exact municipal asset IDs, retrieves complete batches, clips points and park polygons to the city, and clips NCTCOG existing off-street trail segments. Required-source failures occur before snapshot replacement. `src/data/city-districts.json` contains actual polygon intersections for the three cities and both existing congressional snapshots. The runtime clips trails to a selected intersection and filters pins by actual polygon containment; city park outlines remain labeled context. No weather location changes when browsing.

Fort Worth adds **360 municipal amenity records: 119 drinking fountains and 241 shelters**, **317 park features** and **255 off-street trail features**. These are published records, not verified working facilities or a complete amenity inventory. Source/date/status remain visible. OSM collection was unavailable, so no additional OSM coverage is claimed. Refresh with `pnpm data:refresh:dfw`; the baseline flag skips OSM while retaining official city sources.

Sources: [Census incorporated places](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/11), [Fort Worth park assets](https://gisasset.fortworthtexas.gov/ags/rest/services/Assets/Assets_Parks/MapServer) (fountains 10, shelters 25, existing park boundaries 12), [NCTCOG off-street trails](https://geospatial.nctcog.org/map/rest/services/Transportation/BikewayNetwork/FeatureServer/1). Community/library/AC inventory expansion and facility verification remain separate data tasks.

The earlier Arlington/Dallas collection is preserved below; these source counts/dates were not refreshed during the city-navigation change.

| City      | Drinking fountains | Shelters / wooded areas | Municipal park features | Existing public trail segments |
| --------- | -----------------: | ----------------------: | ----------------------: | -----------------------------: |
| Arlington |                115 |                     230 |                     103 |                             99 |
| Dallas    |                272 |                     932 |                     404 |                            168 |

Arlington has 355 total amenity markers. Dallas has 1,229, including 25 library/cooling candidates in addition to water and shade. Counts describe the bundled records, not a survey of every physical amenity. Data was collected October 2, 2026 (America/Chicago); the city expansion was checked October 20, 2026. Collection time is separate from the underlying database age. The oldest OSM database snapshot used is May 6, 2026 for Arlington and June 1, 2026 for Dallas; these dates are shown in the source information.

## Sources and completeness

- Arlington: [municipal boundary](https://gis2.arlingtontx.gov/agsext2/rest/services/BaseMap/BaseMap/MapServer/0), [drinking fountains](https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer/1), [pavilions](https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer/16), [park footprints](https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer/5) and [trails](https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer/4). Retired/inactive assets are excluded. Fountain labels retain the city asset ID. Pavilion points approximate their footprints. Only hike/bike and mountain-bike trail types are used.
- Dallas: [municipal boundary](https://egis.dallascityhall.com/arcgis/rest/services/Basemap/CityLimits_2023/MapServer/0), [park footprints](https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/Dallas_Parks_Source_File/FeatureServer/0) and [trails](https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/Dallas_Trails_Source_File/FeatureServer/0). Park/trail sources were discovered through the [official Dallas Trails page and its dashboard](https://www.dallasparks.org/149/Trails). Only trail records marked Existing are drawn; proposed and other statuses are excluded.
- Both cities: OpenStreetMap potable fountains/taps, shelters, covered picnic tables, woodland, libraries and cooling-space records. Private/no-access features are excluded. Dallas water/shade markers use this community data. OSM point/area centers are filtered to municipal polygons, respecting islands and holes, and nearby duplicates of Arlington assets are removed. Generic parks and decorative fountains are not evidence of shade or drinking water. OpenStreetMap data © contributors, available under the [Open Database License](https://www.openstreetmap.org/copyright).

Municipal queries enumerate all advertised object IDs, retrieve batches and reject omissions or transfer-limit responses. OSM queries cover sections across the entire city bounding box, have no output-count cap, reject partial/error responses and deduplicate shared features. Some city-managed parks extend near or beyond municipal limits; their published geometry is retained. Neither this process nor these sources establish that every physical fountain or shady place is mapped. Flow, openings, shade and AC remain unverified.

## Browsing

1. Open **Relief Map** and choose **Entire Arlington** or **Entire Dallas**.
2. Select **Drinking fountains** or **Shade**, then zoom into a neighborhood or click a numbered cluster.
3. Search a park or trail, for example River Legacy, Vandergriff, White Rock or Kiest, then select its park/trail match to fit that geometry. Additional matches and list entries can be revealed without dropping data.
4. Tap an amenity or choose **View place** for its name, source, status and directions. Local unavailable reports replace the original marker. Public sharing remains a separate opt-in.
5. Use **Show entire city** to reset the view and search. **Reload city map** resets the bundled map view; it does not claim to refresh upstream data.

City browsing and Arlington/Dallas park shortcuts leave the heat-check location unchanged. Distances are explicitly measured from that selected location, not from a city center or an inferred GPS position. The Fort Worth shortcut uses the existing nearby lookup and updates the manual heat-check location. GPS remains optional.

## Data updates and offline use

Run `pnpm data:refresh` to rebuild `src/data/arlington.json` and `src/data/dallas.json`. Successful OSM sections are cached for a day in the project's `work/city-raw` directory; the script validates both complete datasets before replacing the snapshots. The application loads city files on demand and does not require an API lookup to browse their lists, search or overlays. `/relief?city=arlington` and `/relief?city=dallas` return the same dated datasets. **Near my selected location** retains live nearby provider queries and their cache/warnings.

Basemap tiles require a network connection, as does loading browser Leaflet from its CDN when it is not cached. No offline tile-download rights are assumed. Geometry is informational and does not calculate walking routes or measured canopy/shadows. Water/AC availability and a shaded seat are never guaranteed by the records.

## Verification

TypeScript, all 60 automated tests, web/iOS/Android JavaScript exports and the bundled Worker city-response/cache smoke checks passed on October 20. Tests check batch completeness, city holes/islands, southern Arlington coverage, city-wide source provenance, city API validation and existing heat guidance behavior. Native exports are Hermes bundles, not signed phone binaries.

Browser inspection of this expansion was blocked by a browser security policy. The current city controls, clustering, search and mobile layout therefore have not received visual acceptance in this run. Earlier River Legacy-area screenshots and browser checks apply to the previous nearby implementation. Physical-device checks remain listed in `VERIFICATION.md`.
