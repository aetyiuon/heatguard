# Dallas County relief map

Choose **Entire Dallas County** in Relief Map. The county scope is independent of **Entire Dallas**, TX-30 and TX-06; browsing or filtering it leaves the heat-check location unchanged. It includes the full Census Dallas County polygon (`GEOID=48113`), rather than Dallas city limits or a congressional district.

## Snapshot collected October 23, 2026

| Published records                    | Count |
| ------------------------------------ | ----: |
| Drinking-water records               |   260 |
| Shelter / woodland candidates        |   930 |
| Library / public cooling candidates  |    23 |
| Total amenity records                | 1,213 |
| Park features                        |   684 |
| Trail features                       |   862 |
| Searchable Census community portions |    36 |

The park/trail counts describe source features, which can overlap; they are not counts of unique physical facilities. All pins retain unknown working/access status and no official-cooling-center badge. A park is not a shade measurement, woodland is only potential shade, and a library record does not establish open AC.

This expansion adds **673 clipped NCTCOG existing off-street path features** and **29 City of Garland pavilion candidates** to the available official layers and dated city snapshots. Thirty Garland source footprint records were retrieved; the pavilion-pad record is excluded because a pad does not establish a roofed shelter. The other 29 published pavilion footprints produce approximate map points, not measured entrances or a guarantee of shade. Source edit dates are retained separately from retrieval time.

Community search and filters cover their county portions, including Irving, Garland, Mesquite, Richardson, Coppell, DeSoto, Duncanville and Lancaster. Some Census communities intersect only a very small boundary or airport portion; the map never implies that their whole city lies in Dallas County. The remaining county geometry is separately selectable as **Unincorporated / other county areas**. Community buttons can be expanded; search also finds communities, parks and trails. **Show entire county** resets the view.

## Sources and collection safeguards

- [Census county boundaries](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1): exact Dallas County GEOID, Census BAS 2026. [Incorporated places / CDPs](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer) are intersected with that county polygon.
- [NCTCOG existing off-street paths](https://geospatial.nctcog.org/map/rest/services/Transportation/BikewayNetwork/FeatureServer/1): excludes planned/funded facilities, on-street lanes, rural shoulders and pending alignments. The adapter also checks each record's status. Closures, surface conditions and pedestrian access remain unverified.
- [Garland pavilion footprints](https://maps.garlandtx.gov/arcgis/rest/services/dept_PARK/Parks_Facilities/MapServer/4): the city's published pavilion layer and facility type 26. Generic parks and picnic tables do not become shelter pins.
- [USGS PAD-US open-access parks](https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Public_Access/FeatureServer/0), [TPWD park boundaries](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Boundaries/FeatureServer/0), [designated hiking trails](https://tpwd.texas.gov/arcgis/rest/services/Parks/TexasStateParksTrails/MapServer/0) and [public shelters](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Public_Areas/FeatureServer/1).
- The dated Arlington/Dallas municipal and OpenStreetMap snapshots described in [DFW-MAP.md](DFW-MAP.md). Only features inside/intersecting the county are retained. Included cached OSM records retain their original collection timestamps and June 1, 2026 database provenance; October 23 is not a new observation of those amenities. OpenStreetMap data is [© contributors, ODbL](https://www.openstreetmap.org/copyright).

ArcGIS collection enumerates all advertised object IDs, downloads complete batches and rejects missing IDs. The initial ID query uses a spatial envelope; subsequent exact-ID batches do not reapply that envelope, avoiding a server behavior that dropped coarse-index hits. Every delivered pin is checked against the actual county polygon. Parks are intersected with it and crossing trails are clipped, including crossings whose original endpoints are outside. Generic GIS GETs have bounded retries for temporary failures.

## Remaining coverage work

**County-wide fountain and shade coverage is incomplete.** The snapshot deliberately reports `coverage.status=baseline`, with **0/4 county-wide OpenStreetMap query sections completed**. This describes unfinished OSM queries; the county outline, community geometry and official park/path collection are available. A full refresh attempted October 23 failed on all three configured Overpass services and preserved the existing snapshot byte-for-byte.

Amenity records remain concentrated in Dallas city, with a first municipal shelter expansion into Garland. In particular, zero current pins for Irving, Mesquite or Richardson does not mean those cities lack fountains or shelter. The next data tasks are to add official amenity sources for those cities, then the southern county communities, and retry complete county-wide OSM collection when providers respond. Do not infer drinking-water coordinates from a park-wide amenity flag or decorative fountain label.

## Rebuild and API

```powershell
# Full collection: retain the prior published snapshot if any required section fails.
pnpm data:refresh:dallas-county
# Bounded provider diagnostic, with the same preservation behavior.
pnpm data:refresh:dallas-county --no-split
# Explicit limited baseline from official layers plus dated city records.
pnpm data:dallas-county:baseline
```

`scripts/refresh-dallas-county.ts` uses shared collection/clipping in `refresh-districts.ts` and source adapters in `county-sources.ts`. Successful raw requests are cached for one day in ignored `work/dallas-county-raw/`; the final snapshot is published by atomic rename only after construction succeeds.

`/relief?county=dallas` returns `src/data/dallas-county.json`, including provenance, coverage, communities and counts, without requiring coordinates. Unsupported, repeated or conflicting city/county/district scopes return HTTP 400. Existing city and district routes stay available. The app loads county data on demand from its bundle, so lists/search/overlays do not depend on a live API request; basemap tiles and the browser Leaflet script still need network access or existing cache.

See [VERIFICATION.md](VERIFICATION.md) for checks actually executed and remaining browser/device limitations.
