import { readFile, writeFile, rename } from 'node:fs/promises';
import { allFeatures, spatialQueryLoader } from './refresh-cities';
import { geometryPolygons, intersectPolygons, lineClipper } from './district-geometry';
import { countyTrails, NCTCOG_TRAILS } from './county-sources';
import { insidePolygons, polygonBounds } from '../src/domain/cities';
import { normalizeOsmPins } from '../backend/relief';
import { fortWorthPins, FORT_WORTH_PARK_ASSETS } from '../backend/fort-worth';
import { CityDataset } from '../src/domain/types';

const boundarySource =
  'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer/11';
async function json(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
  if (!r.ok) throw new Error(`GIS ${r.status}`);
  const d = await r.json();
  if (d.error || d.exceededTransferLimit)
    throw new Error(d.error?.message ?? 'Incomplete GIS response');
  return d;
}
async function save(name: string, value: unknown) {
  const path = new URL(`../src/data/${name}.json`, import.meta.url);
  const temp = new URL(`../src/data/${name}.pending`, import.meta.url);
  await writeFile(temp, JSON.stringify(value));
  await rename(temp, path);
}
async function refresh() {
  const fetchedAt = new Date().toISOString();
  const raw = await json(
    `${boundarySource}/query?${new URLSearchParams({ f: 'geojson', where: "STATE='48' AND BASENAME='Fort Worth'", outFields: 'GEOID,BASENAME', outSR: '4326', returnGeometry: 'true', geometryPrecision: '6', maxAllowableOffset: '0.00003' })}`,
  );
  if (raw.features?.length !== 1) throw new Error('Expected exactly one Fort Worth boundary');
  const boundary = geometryPolygons(raw.features[0].geometry);
  const bounds = polygonBounds(boundary),
    clip = lineClipper(boundary);
  const datasets: CityDataset[] = await Promise.all(
    ['arlington', 'dallas', 'dallas-county', 'tx06', 'tx30'].map(async (name) =>
      JSON.parse(await readFile(new URL(`../src/data/${name}.json`, import.meta.url), 'utf8')),
    ),
  );
  const pins = new Map(
    datasets
      .flatMap((d) => d.pins)
      .filter((p) => insidePolygons(p.longitude, p.latitude, boundary))
      .map((p) => [p.id, p]),
  );
  const warnings = [
    'Fort Worth city limits are mapped. Published amenity records are incomplete; empty areas do not establish that no relief exists. Access, hours, shade and water flow are unverified.',
  ];
  const sources: CityDataset['sources'] = [
    { name: 'U.S. Census BAS 2026 · Fort Worth city limits', url: boundarySource, records: 1 },
  ];
  const trails = countyTrails(
    await allFeatures(
      NCTCOG_TRAILS,
      '*',
      "Status='Existing' AND OnOffStr='Off-Street'",
      false,
      spatialQueryLoader(bounds, json),
    ),
    clip,
  );
  sources.push({
    name: 'NCTCOG existing off-street paths · clipped to Fort Worth',
    url: NCTCOG_TRAILS,
    records: trails.length,
  });
  const [water, shelters, parkFeatures] = await Promise.all([
    allFeatures(`${FORT_WORTH_PARK_ASSETS}/10`, '*', '1=1', false, json),
    allFeatures(`${FORT_WORTH_PARK_ASSETS}/25`, '*', '1=1', false, json),
    allFeatures(`${FORT_WORTH_PARK_ASSETS}/12`, '*', '1=1', true, json),
  ]);
  for (const p of [
    ...fortWorthPins(water, 10, fetchedAt),
    ...fortWorthPins(shelters, 25, fetchedAt),
  ].filter((p) => insidePolygons(p.longitude, p.latitude, boundary)))
    pins.set(p.id, p);
  sources.push({
    name: 'City of Fort Worth · drinking fountains and shelters',
    url: FORT_WORTH_PARK_ASSETS,
    records: water.length + shelters.length,
  });
  try {
    if (process.argv.includes('--baseline')) throw new Error('OSM baseline');
    const [w, s, e, n] = bounds;
    const query = `[out:json][timeout:25];(nwr[amenity~"^(drinking_water|shelter|library)$"](${s},${w},${n},${e});nwr[man_made=water_tap][drinking_water=yes](${s},${w},${n},${e}););out center tags;`;
    const r = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(40000),
    });
    const d = await r.json();
    if (!r.ok || d.remark || !Array.isArray(d.elements)) throw new Error('OSM lookup incomplete');
    for (const p of normalizeOsmPins(d.elements, fetchedAt).filter((p) =>
      insidePolygons(p.longitude, p.latitude, boundary),
    ))
      pins.set(p.id, p);
    sources.push({
      name: `OpenStreetMap · database ${d.osm3s?.timestamp_osm_base ?? 'unknown'}`,
      url: 'https://www.openstreetmap.org/copyright',
      records: d.elements.length,
    });
  } catch {
    warnings.push(
      'The Fort Worth OpenStreetMap refresh was unavailable; only available source records are shown.',
    );
  }
  const parks = datasets
    .flatMap((d) => d.parks)
    .flatMap((p) => {
      const polygons = intersectPolygons(p.polygons, boundary);
      return polygons.length ? [{ ...p, polygons }] : [];
    });
  for (const f of parkFeatures) {
    if (/planned|proposed|inactive|retired|future/i.test(f.properties.STATUS ?? '')) continue;
    const polygons = intersectPolygons(geometryPolygons(f.geometry), boundary);
    if (polygons.length)
      parks.push({
        id: `fort-worth-park-${f.properties.OBJECTID_1 ?? f.properties.OBJECTID}`,
        name: f.properties.PARK_NAME || 'Fort Worth park',
        polygons,
        sourceUrl: `${FORT_WORTH_PARK_ASSETS}/12`,
      });
  }
  sources.push({
    name: 'City of Fort Worth · existing park boundaries',
    url: `${FORT_WORTH_PARK_ASSETS}/12`,
    records: parkFeatures.length,
  });
  const fortWorth: CityDataset = {
    city: 'fort-worth',
    name: 'Fort Worth',
    areaType: 'city',
    boundaryLabel: 'Fort Worth · full city limits',
    boundarySource,
    boundaryVersion: 'Census BAS 2026',
    fetchedAt,
    bounds,
    boundary,
    pins: [...pins.values()],
    parks: [...new Map(parks.map((p) => [p.id, p])).values()],
    trails,
    sources,
    warnings,
  };
  await save('fort-worth', fortWorth);
  const cities = [datasets[0]!, datasets[1]!, fortWorth],
    districts = datasets.slice(3);
  const overlays = Object.fromEntries(
    cities.map((c) => [
      c.city,
      districts.flatMap((d) => {
        const polygons = intersectPolygons(c.boundary, d.boundary);
        return polygons.length
          ? [
              {
                id: d.city,
                name: d.city === 'tx06' ? 'District 6' : 'District 30',
                polygons,
                bounds: polygonBounds(polygons),
                partial: true,
                pinCount: c.pins.filter((p) => insidePolygons(p.longitude, p.latitude, polygons))
                  .length,
                parkCount: 0,
                trailCount: 0,
              },
            ]
          : [];
      }),
    ]),
  );
  await save('city-districts', overlays);
  console.log(
    JSON.stringify({
      city: 'fort-worth',
      pins: pins.size,
      parks: fortWorth.parks.length,
      trails: trails.length,
      overlays: Object.fromEntries(
        Object.entries(overlays).map(([k, v]) => [k, v.map((r) => r.name)]),
      ),
      warnings,
    }),
  );
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/refresh-dfw.ts'))
  void refresh().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
