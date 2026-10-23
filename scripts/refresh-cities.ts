import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { CityDataset, CityId, PolygonCoordinates, ReliefTrail } from '../src/domain/types';
import { insidePolygons, polygonBounds } from '../src/domain/cities';
import { ARLINGTON_PARKS, normalizeArlingtonPins, normalizeArlingtonTrails } from '../backend/dfw';
import { normalizeOsmPins } from '../backend/relief';
import { distanceMeters } from '../src/domain/relief';

const arlingtonBoundary =
  'https://gis2.arlingtontx.gov/agsext2/rest/services/BaseMap/BaseMap/MapServer/0';
const dallasBoundary =
  'https://egis.dallascityhall.com/arcgis/rest/services/Basemap/CityLimits_2023/MapServer/0';
const dallasParks =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/Dallas_Parks_Source_File/FeatureServer/0';
const dallasTrails =
  'https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/Dallas_Trails_Source_File/FeatureServer/0';
let fossgisRetryAfter = 0;
async function json(url: string, timeout = 25000): Promise<any> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(timeout),
    headers: {
      'User-Agent': 'HeatGuard/0.1 (local development heat-awareness app)',
      Accept: 'application/json',
    },
  });
  if (!r.ok) throw new Error(`${r.status}: ${url.split('?')[0]}`);
  const d = await r.json();
  if (d.error || d.remark) throw new Error(d.error?.message || d.remark);
  return d;
}
export async function allFeatures(
  url: string,
  fields: string,
  where = '1=1',
  geojson = false,
  loader = json,
) {
  // IDs are uncapped by ArcGIS; fetch every advertised ID in small batches and check omissions.
  const ids = await loader(
    `${url}/query?${new URLSearchParams({ f: 'json', where, returnIdsOnly: 'true' })}`,
  );
  if (!Array.isArray(ids.objectIds)) throw new Error('GIS object IDs missing');
  const features: any[] = [];
  for (let offset = 0; offset < ids.objectIds.length; offset += 150) {
    const batch = ids.objectIds.slice(offset, offset + 150);
    const d = await loader(
      `${url}/query?${new URLSearchParams({ f: geojson ? 'geojson' : 'json', objectIds: batch.join(','), outFields: fields, outSR: '4326', geometryPrecision: '5', maxAllowableOffset: '0.00003', returnGeometry: 'true' })}`,
    );
    if (d.exceededTransferLimit || !Array.isArray(d.features))
      throw new Error('GIS response incomplete');
    const returned = new Set(
      d.features.map(
        (f: any) => (f.attributes ?? f.properties)[ids.objectIdFieldName ?? 'OBJECTID'],
      ),
    );
    if (batch.some((id: number) => !returned.has(id))) throw new Error('GIS omitted requested IDs');
    features.push(...d.features);
  }
  return features;
}
function polygons(g: any): PolygonCoordinates {
  return g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
}
async function osm(boundary: PolygonCoordinates) {
  const [w, s, e, n] = polygonBounds(boundary);
  const cacheDir = new URL('../work/city-raw/', import.meta.url);
  await mkdir(cacheDir, { recursive: true });
  async function tile(w: number, s: number, e: number, n: number, depth = 0): Promise<any[]> {
    const bbox = [s, w, n, e].map((v) => v.toFixed(5)).join(',');
    const file = new URL(`${bbox}.json`, cacheDir);
    try {
      const saved = JSON.parse(await readFile(file, 'utf8'));
      if (Date.now() - saved.savedAt < 86400000) return [saved.data];
    } catch {}
    const query = `[out:json][timeout:10][maxsize:33554432];(nwr[amenity~"^(drinking_water|shelter|library)$"](${bbox});nwr[amenity=fountain][drinking_water=yes](${bbox});nwr[man_made=water_tap][drinking_water=yes](${bbox});nwr[leisure=picnic_table][covered=yes](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox});nwr[social_facility=cooling_center](${bbox}););out center tags;`;
    for (const host of [
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ]) {
      try {
        if (host.includes('overpass-api.de') && Date.now() < fossgisRetryAfter)
          await new Promise((resolve) => setTimeout(resolve, fossgisRetryAfter - Date.now()));
        const response = await fetch(host, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          headers: {
            'User-Agent': 'HeatGuard/0.1 (local development heat-awareness app)',
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          signal: AbortSignal.timeout(16000),
        });
        if (!response.ok) throw new Error(`${response.status}: ${host}`);
        const d = await response.json();
        if (d.remark) throw new Error(d.remark);
        if (!Array.isArray(d.elements)) throw new Error('Missing OSM elements');
        await writeFile(file, JSON.stringify({ savedAt: Date.now(), data: d }));
        console.log('OSM section', bbox, d.elements.length);
        return [d];
      } catch (e) {
        if (host.includes('overpass-api.de') && /429|406/.test(String(e)))
          fossgisRetryAfter = Date.now() + 30000;
        console.log('OSM section retry', bbox, String(e).slice(0, 130));
      }
    }
    if (depth >= 2) throw new Error(`OSM section ${bbox} incomplete; snapshots unchanged.`);
    const x = (w + e) / 2,
      y = (s + n) / 2,
      result = [];
    for (const b of [
      [w, s, x, y],
      [x, s, e, y],
      [w, y, x, n],
      [x, y, e, n],
    ])
      result.push(...(await tile(b[0]!, b[1]!, b[2]!, b[3]!, depth + 1)));
    const merged = {
      elements: result.flatMap((d) => d.elements),
      osm3s: {
        timestamp_osm_base: result
          .map((d) => d.osm3s?.timestamp_osm_base)
          .filter(Boolean)
          .sort()[0],
      },
    };
    await writeFile(file, JSON.stringify({ savedAt: Date.now(), data: merged }));
    return [merged];
  }
  const sections = [],
    size = cityGridSize(e - w, n - s);
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      sections.push([
        w + ((e - w) * col) / size,
        s + ((n - s) * row) / size,
        w + ((e - w) * (col + 1)) / size,
        s + ((n - s) * (row + 1)) / size,
      ]);
  const results = [];
  for (const b of sections) results.push(...(await tile(b[0]!, b[1]!, b[2]!, b[3]!)));
  const unique = new Map<string, any>();
  for (const d of results) for (const f of d.elements) unique.set(`${f.type}/${f.id}`, f);
  return {
    elements: [...unique.values()],
    time: results
      .map((d) => d.osm3s?.timestamp_osm_base)
      .filter(Boolean)
      .sort()[0],
  };
}
function cityGridSize(width: number, height: number) {
  return Math.max(2, Math.ceil(Math.max(width, height) / 0.09));
}
export async function buildCity(city: CityId): Promise<CityDataset> {
  const fetchedAt = new Date().toISOString();
  const sources: CityDataset['sources'] = [];
  const boundarySource = city === 'arlington' ? arlingtonBoundary : dallasBoundary;
  const b = await allFeatures(
    boundarySource,
    'OBJECTID',
    city === 'arlington' ? "MUNICIPALNAME='Arlington'" : "CITY='Dallas'",
    true,
  );
  const boundary = b.flatMap((f) => polygons(f.geometry));
  const bounds = polygonBounds(boundary);
  sources.push({
    name: `City of ${city === 'arlington' ? 'Arlington' : 'Dallas'} boundary`,
    url: boundarySource,
    records: b.length,
  });
  console.log(city, 'boundary', bounds);
  const pUrl = city === 'arlington' ? `${ARLINGTON_PARKS}/5` : dallasParks;
  const parksRaw = await allFeatures(
    pUrl,
    city === 'arlington'
      ? 'OBJECTID,Name1,psPark_Address,psPark_Status'
      : 'OBJECTID,PARK_NAME,ADDRESS,ParkStatus',
    '1=1',
    true,
  );
  sources.push({ name: 'Municipal park polygons', url: pUrl, records: parksRaw.length });
  const parks = parksRaw.flatMap((f) => {
    const a = f.properties,
      shape = polygons(f.geometry);
    if (!shape.length) return [];
    return [
      {
        id: `${city}-park-${a.OBJECTID}`,
        name: a.Name1 || a.PARK_NAME || 'Mapped park',
        address: a.psPark_Address || a.ADDRESS,
        polygons: shape,
        sourceUrl: pUrl,
      },
    ];
  });
  const tUrl = city === 'arlington' ? `${ARLINGTON_PARKS}/4` : dallasTrails;
  const t = await allFeatures(
    tUrl,
    city === 'arlington'
      ? 'OBJECTID,ID,ParkID,Name1,Type1,Inactive,Retired'
      : 'OBJECTID,NAME,STATUS',
  );
  sources.push({ name: 'Municipal trail segments', url: tUrl, records: t.length });
  const trails: ReliefTrail[] =
    city === 'arlington'
      ? normalizeArlingtonTrails(t)
      : t
          .filter(
            (f) =>
              String(f.attributes.STATUS).toLowerCase() === 'existing' && f.geometry?.paths?.length,
          )
          .map((f) => ({
            id: `dallas-trail-${f.attributes.OBJECTID}`,
            name: f.attributes.NAME || 'Dallas trail',
            paths: f.geometry.paths.map((path: number[][]) => path.map((p) => [p[0], p[1]])),
            source: 'City of Dallas · Trail GIS layer',
            sourceUrl: tUrl,
          }));
  let cityPins: CityDataset['pins'] = [];
  if (city === 'arlington') {
    const place = {
      latitude: 32.7357,
      longitude: -97.1081,
      name: 'Arlington',
      emergencyNumber: '911',
    };
    for (const layer of [1, 16] as const) {
      const url = `${ARLINGTON_PARKS}/${layer}`;
      const features = await allFeatures(
        url,
        layer === 1
          ? 'OBJECTID,ID,ParkID,Inactive,Retired,last_edited_date'
          : 'OBJECTID,ID,Parks,Name1,Inactive,Retired,last_edited_date',
      );
      sources.push({
        name: layer === 1 ? 'Municipal drinking fountains' : 'Municipal pavilions',
        url,
        records: features.length,
      });
      cityPins.push(...normalizeArlingtonPins(features, layer, place, fetchedAt, true));
    }
  }
  const o = await osm(boundary);
  const osmPins = normalizeOsmPins(o.elements, fetchedAt).filter((p) =>
    insidePolygons(p.longitude, p.latitude, boundary),
  );
  for (const pin of osmPins) {
    const park = parks.find((p) => insidePolygons(pin.longitude, pin.latitude, p.polygons));
    if (park) {
      pin.parkName = park.name;
      if (!pin.name.startsWith(park.name)) pin.name = `${park.name} · ${pin.name}`;
    }
  }
  sources.push({
    name: `OpenStreetMap city-wide features (database ${o.time ?? 'timestamp unavailable'})`,
    url: 'https://www.openstreetmap.org/copyright',
    records: o.elements.length,
  });
  const pins = [
    ...cityPins,
    ...osmPins.filter((p) => !cityPins.some((c) => c.kind === p.kind && distanceMeters(p, c) < 15)),
  ];
  return {
    city,
    name: city === 'arlington' ? 'Arlington' : 'Dallas',
    fetchedAt,
    bounds,
    boundary,
    boundarySource,
    pins,
    parks,
    trails,
    sources,
    warnings: [
      'Whole-city coverage of published records; unmapped fountains and shade may be missing. Confirm water, shade, hours and access.',
      ...(city === 'dallas'
        ? [
            'Dallas fountain and shade markers come from OpenStreetMap; municipal park polygons are not evidence of shade.',
          ]
        : []),
      'Park and trail overlays show published geometry, including city-managed sites near the city limits. They are not surveyed walking routes.',
    ],
  };
}
async function main() {
  const datasets = [];
  for (const city of ['arlington', 'dallas'] as const) datasets.push(await buildCity(city));
  await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
  for (const data of datasets) {
    await writeFile(
      new URL(`../src/data/${data.city}.json`, import.meta.url),
      JSON.stringify(data),
    );
    console.log(
      data.city,
      JSON.stringify({
        pins: data.pins.length,
        water: data.pins.filter((p) => p.kind === 'water').length,
        shade: data.pins.filter((p) => p.kind === 'shade').length,
        parks: data.parks.length,
        trails: data.trails.length,
        sources: data.sources,
      }),
    );
  }
}
if (process.argv[1]?.replace(/\\/g, '/').endsWith('/refresh-cities.ts'))
  void main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
