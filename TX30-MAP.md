# Texas Congressional District 30

Relief Map opens **Texas District 30**. This uses **TX-30 for the 119th Congress (2025–2027), Census BAS 2026**, queried as `GEOID=4830`. It is distinct from the new 2026 election / 120th Congress boundary. District 6 and the full Arlington/Dallas city maps remain selectable. Map browsing does not change the saved heat-check location.

## Published snapshot — October 22, 2026

- Full district boundary, with Dallas and Tarrant county portions and county filters.
- **19 searchable Census community portions**: Arlington, Balch Springs, Bear Creek Ranch, Cedar Hill, Dallas, DeSoto, Duncanville, Ferris, Glenn Heights, Grand Prairie, Highland Park, Hutchins, Lancaster, Mansfield, Mesquite, Ovilla, Red Oak, Seagoville, and Wilmer. Some communities intersect only a small part of the district; this is not a claim that their entire city is in TX-30.
- **279 park features and 112 trail features**, clipped to the district. Source records can overlap for the same physical park or trail.
- **531 amenity records**: 109 drinking-water records, 414 shelter/woodland candidates, and 8 public cooling candidates. Status, water flow, opening hours, and access remain unverified. A park polygon is not a shade measurement, and a library candidate is not an official cooling center.

| County portion | Amenity records | Park features | Trail features |
| --- | ---: | ---: | ---: |
| Dallas, part | 527 | 277 | 111 |
| Tarrant, part | 4 | 2 | 1 |

County counts describe the published source records. Cross-county park/trail records may appear in both county counts. Zero records in a community do not establish that it has no amenities.

## Coverage and dates

**Fountain and shade coverage is incomplete.** All three existing Overpass endpoints timed out during the attempted district refresh. The failed full refresh retained the previous usable snapshot rather than replacing it with an empty or falsely complete catalog. The delivered snapshot is explicitly `coverage.status=baseline`, with **0/2 district-wide community-data sections completed**. `boundaryCoverage=0` describes those unfinished OSM queries, not the availability of the official district outline.

Official Census, USGS PAD-US, and Texas Parks & Wildlife layers were retrieved for this district. Municipal park/trail geometry and cached OSM amenity records from the October 2 Arlington/Dallas snapshots were also clipped to TX-30. Those amenity records retain their original timestamps; they were not relabeled as observations from October 22. The oldest cached OSM database date is May 6, 2026. Amenity coverage is especially sparse outside Dallas city.

## Sources

- [Census 119th Congressional Districts](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4), checked for layer name, `CDSESSN=119`, and `GEOID=4830`.
- [Representative's district description](https://crockett.house.gov/about/our-district), identifying Dallas and Tarrant counties.
- [Census county boundaries](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1) and [Census incorporated places/CDPs](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer).
- [USGS PAD-US public-access parks](https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Public_Access/FeatureServer/0).
- [TPWD park boundaries](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Boundaries/FeatureServer/0), [public pavilions/shelters](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Public_Areas/FeatureServer/1), and [designated trails](https://tpwd.texas.gov/arcgis/rest/services/Parks/TexasStateParksTrails/MapServer/0).
- Municipal and OpenStreetMap source links and dates remain attached to the individual records and dataset `sources` array. See [DFW-MAP.md](DFW-MAP.md) for the underlying city snapshots and [OpenStreetMap attribution](https://www.openstreetmap.org/copyright).

## Refresh and checks

```powershell
# Full public-data refresh; stops without replacing the snapshot if any section fails.
pnpm data:refresh:tx30
# Bound the retry when diagnosing unavailable providers.
pnpm data:refresh:tx30 --no-split
# Explicitly rebuild the limited catalog from official layers and dated city records.
pnpm data:tx30:baseline
```

`scripts/refresh-districts.ts` shares collection and clipping logic for TX-06 and TX-30. Raw ingestion caches live in the ignored `work/` directory. `/relief?district=tx30` serves the complete published snapshot without requiring coordinates and rejects conflicting city/district parameters.

All 75 tests and TypeScript passed. Tests cover both county portions, community search data, pin containment/provenance, clipped park polygons and trail segments, crossing-trail county membership, honest incomplete coverage, and district API selection. Expo web/iOS/Android JavaScript/Hermes exports passed; these are not signed binaries. The local API and updated web JavaScript bundle returned HTTP 200. Browser visual and physical-device acceptance remain unverified under the earlier browser security-policy block.
