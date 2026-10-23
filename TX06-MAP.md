# Texas Congressional District 6

**Texas District 6** remains selectable in Relief Map alongside the new default **Texas District 30** view documented in [TX30-MAP.md](TX30-MAP.md). The selected geography is **TX-06 for the 119th Congress (2025–2027), Census BAS 2026**. The 2026 election / 120th Congress map is a separate boundary version. Arlington and Dallas remain available as full-city modes, and the selected heat-check location is unchanged by map browsing.

## Current dataset — October 20, 2026

- Full district boundary and all nine intersecting county portions, including rural areas beyond DFW.
- **89 searchable Census communities**, including Waxahachie, Corsicana, Hillsboro, Palestine, Jacksonville, Rusk, Alto and Whitney. A community crossing the district boundary is represented by its district portion.
- **102 park features and 25 trail features**, clipped to the district boundary. These are source features, with possible overlapping records for the same physical park.
- **104 amenity markers: 24 drinking-water records, 79 shelter/woodland candidates and one public cooling candidate.** These remain unverified. Most amenity records are cached DFW data collected October 2; the district also adds an official state-park shelter record. The oldest underlying OSM database snapshot is May 6, 2026 and is displayed in the source information.

**District-wide fountain and shade collection is incomplete.** All three public Overpass endpoints timed out during district requests and minimal diagnostics. The published dataset is explicitly marked `coverage.status = baseline`, with **0 of 20 community-data query sections completed**. It does not imply that rural counties have no fountains or shade. The full geography, community search and available official park/trail sources are usable while that source is unavailable.

| County portion  | Amenity records | Park features | Trail features |
| --------------- | --------------: | ------------: | -------------: |
| Anderson        |               0 |             1 |              0 |
| Cherokee        |               0 |             1 |              0 |
| Dallas, part    |              26 |            28 |              2 |
| Ellis           |               0 |            19 |              0 |
| Freestone, part |               0 |             2 |              0 |
| Hill            |               1 |             1 |              4 |
| Johnson, part   |               0 |             1 |              0 |
| Navarro         |               0 |             5 |              0 |
| Tarrant, part   |              77 |            45 |             19 |

Park records crossing a county line can appear in more than one county count. Counts are records, not independent field confirmations or a complete physical inventory.

## Sources

- [U.S. Census 119th Congressional District layer](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Legislative/MapServer/4), queried for `GEOID=4806`, with the layer name and Congress session checked before use.
- [Census county boundaries](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1) and [BAS 2026 incorporated places / Census Designated Places](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer), intersected with TX-06.
- [USGS PAD-US public-access service](https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Public_Access/FeatureServer/0): only open-access local parks, local recreation areas and state parks. [USGS documentation](https://www.usgs.gov/programs/gap-analysis-project/science/pad-us-web-services) describes gaps in local data; current openings and restrictions still require checking.
- [Texas Parks & Wildlife boundaries](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Boundaries/FeatureServer/0), [public pavilions/shelters](https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Public_Areas/FeatureServer/1) and [official trails](https://tpwd.texas.gov/arcgis/rest/services/Parks/TexasStateParksTrails/MapServer/0). Trail records must be designated official and permit hiking; closures remain unverified.
- Existing Arlington/Dallas snapshots, with their original dates and provenance retained. See `DFW-MAP.md`. OpenStreetMap data © contributors, available under [ODbL](https://www.openstreetmap.org/copyright).

Parks are context, not evidence of shade. Ordinary drinking-water status is unknown until checked; mapped woodland is only potential shade. Clipped geometry is informational, not a walking route or a legal boundary survey.

## Using the district view

Choose a county to fit its district portion and filter amenities/trails. The coverage card shows available counts and explicit data gaps. Search a community, park, trail, county or fountain ID. Community results zoom to the portion inside the district. **Show entire district** restores the full view. Distances are measured from the named heat-check location, not an inferred location or district center.

**Suggest a place** starts with blank coordinates. Pick its location on the map or enter coordinates explicitly; suggestions outside the selected area are rejected. This prevents a rural report from inheriting the heat-check location in DFW. Suggestions save locally as unverified, and public sharing remains opt-in. A failed public share retains the local record and reports that limitation.

## Rebuilding data

```sh
pnpm data:refresh:district
```

The full collector enumerates all GIS object IDs, rejects missing batches, partitions the district into 20 intersecting sections and retrieves uncapped OSM amenities and park/path geometry. Partial/error responses are rejected; successful sections are cached for one day in `work/tx06-raw`. It validates spatial coverage before atomically replacing the dataset. An upstream failure retains the previous snapshot.

```sh
pnpm data:district:baseline
```

This explicitly builds the limited official-data/cached-DFW catalog without claiming completed OSM collection. It is the mode used for the delivered dataset because the public services were unavailable. The two commands have deliberately different coverage labels.

On this Windows host, Node could not construct TPWD's certificate chain. The collector uses PowerShell 7's normal validated HTTPS retrieval for that specific host as a fallback; it never disables certificate validation or changes system trust or execution policies. Other platforms use normal Node HTTPS. The helper requires `pwsh.exe` if this Windows fallback is needed.

Geometry processing uses the pinned, licensed standalone distributions in `scripts/vendor`; they run only during ingestion/tests and do not add mobile runtime dependencies.

## Validation and outstanding work

The automated checks validate county coverage, communities beyond DFW, district-only pins and park shapes, split trail crossings, holes/islands, API scope validation and truthful incomplete-coverage metadata. Browser visual acceptance remains unverified because browser inspection was blocked by a browser security policy. Native physical-device acceptance remains outstanding.

The major remaining data task is completing the 20 OSM sections when a provider becomes reachable, followed by source verification and local reports for rural fountain/shade locations. The shipped map does not claim this task is complete.
