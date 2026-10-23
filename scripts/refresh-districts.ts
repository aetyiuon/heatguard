import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { polygonClipping, osmToGeoJSON } from './geometry-vendor';
import {
  CityDataset,
  DistrictId,
  CoverageRegion,
  MappedPark,
  PolygonCoordinates,
  ReliefPin,
  ReliefTrail,
} from '../src/domain/types';
import { insidePolygons, polygonBounds } from '../src/domain/cities';
import { distanceMeters } from '../src/domain/relief';
import { normalizeOsmPins } from '../backend/relief';
import { allFeatures } from './refresh-cities';
import {
  districtSections,
  geometryPolygons,
  intersectPolygons,
  lineClipper,
  polygonArea,
  rectangle,
} from './district-geometry';
const CENSUS = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb';
const DISTRICT = `${CENSUS}/Legislative/MapServer/4`;
const COUNTIES = `${CENSUS}/State_County/MapServer/1`;
const PLACES = `${CENSUS}/Places_CouSub_ConCity_SubMCD/MapServer`;
const TPWD_PARKS =
  'https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Boundaries/FeatureServer/0';
const TPWD_TRAILS =
  'https://tpwd.texas.gov/arcgis/rest/services/Parks/TexasStateParksTrails/MapServer/0';
const TPWD_STRUCTURES =
  'https://services1.arcgis.com/1mtXwieMId59thmg/arcgis/rest/services/Texas_State_Parks_Public_Areas/FeatureServer/1';
const PADUS =
  'https://services.arcgis.com/v01gqwM5QqNysAAi/ArcGIS/rest/services/PADUS_Public_Access/FeatureServer/0';
const DISTRICTS = {
  tx06: {
    number: 6,
    geoid: '4806',
    counties: [
      'Anderson',
      'Cherokee',
      'Dallas',
      'Ellis',
      'Freestone',
      'Hill',
      'Johnson',
      'Navarro',
      'Tarrant',
    ],
  },
  tx30: { number: 30, geoid: '4830', counties: ['Dallas', 'Tarrant'] },
} satisfies Record<DistrictId, { number: number; geoid: string; counties: string[] }>;
const runFile = promisify(execFile);
const json = async (url: string) => {
  let data: any;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'HeatGuard/0.1 public-data district map',
      },
    });
    if (!response.ok) throw new Error(`Upstream ${response.status}: ${url.split('?')[0]}`);
    data = await response.json();
  } catch (error) {
    if (
      process.platform !== 'win32' ||
      new URL(url).hostname !== 'tpwd.texas.gov' ||
      (error as any)?.cause?.code !== 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    )
      throw error;
    const result = await runFile(
      'pwsh.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-File',
        fileURLToPath(new URL('./fetch-tpwd-json.ps1', import.meta.url)),
        '-Url',
        url,
      ],
      { encoding: 'utf8', windowsHide: true, maxBuffer: 20 * 1024 * 1024 },
    );
    data = JSON.parse(result.stdout);
  }
  if (data.error) throw new Error(data.error.message);
  return data;
};
async function cached(cacheDir: URL, name: string, get: () => Promise<any>) {
  const file = new URL(name + '.json', cacheDir);
  try {
    const saved = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - saved.savedAt < 86400000) return saved.data;
  } catch {}
  const data = await get();
  await writeFile(file, JSON.stringify({ savedAt: Date.now(), data }));
  return data;
}
let retryAfter = 0;
async function overpass(query: string, cacheDir: URL) {
  const key = createHash('sha256').update(query).digest('hex');
  return cached(cacheDir, `osm-${key}`, async () => {
    for (const host of [
      'https://overpass.private.coffee/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
      'https://overpass-api.de/api/interpreter',
    ]) {
      try {
        if (host.includes('overpass-api.de') && Date.now() < retryAfter)
          await new Promise((r) => setTimeout(r, retryAfter - Date.now()));
        const response = await fetch(host, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(18000),
          headers: {
            Accept: 'application/json',
            'User-Agent': 'HeatGuard/0.1 public-data district map',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const d = await response.json();
        if (d.remark || !Array.isArray(d.elements)) throw new Error(d.remark || 'Missing elements');
        return { elements: d.elements, base: d.osm3s?.timestamp_osm_base, provider: host };
      } catch (e) {
        if (host.includes('overpass-api.de') && /429|406/.test(String(e)))
          retryAfter = Date.now() + 30000;
        console.log('OSM provider retry:', host, String(e).slice(0, 140));
      }
    }
    throw new Error('All OSM providers failed for a section');
  });
}
async function section(
  bounds: CityDataset['bounds'],
  kind: 'amenities' | 'geometry',
  cacheDir: URL,
  depth = 0,
): Promise<any[]> {
  const [w, s, e, n] = bounds,
    bbox = [s, w, n, e].map((v) => v.toFixed(6)).join(',');
  const selectors =
    kind === 'amenities'
      ? `nwr[amenity~"^(drinking_water|shelter|library)$"](${bbox});nwr[amenity=fountain][drinking_water=yes](${bbox});nwr[man_made=water_tap][drinking_water=yes](${bbox});nwr[leisure=picnic_table][covered=yes](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox});nwr[social_facility=cooling_center](${bbox});`
      : `nwr[leisure~"^(park|nature_reserve)$"](${bbox});way[highway~"^(path|footway|cycleway)$"][footway!~"^(sidewalk|crossing)$"](${bbox});`;
  try {
    return [
      await overpass(
        `[out:json][timeout:8][maxsize:33554432];(${selectors});out ${kind === 'amenities' ? 'center tags' : 'geom'};`,
        cacheDir,
      ),
    ];
  } catch (error) {
    if (depth >= (process.argv.includes('--no-split') ? 0 : 2))
      throw new Error(`Incomplete ${kind} section ${bbox}; previous district snapshot retained.`);
    const x = (w + e) / 2,
      y = (s + n) / 2,
      results = [];
    for (const b of [
      [w, s, x, y],
      [x, s, e, y],
      [w, y, x, n],
      [x, y, e, n],
    ])
      results.push(...(await section(b as CityDataset['bounds'], kind, cacheDir, depth + 1)));
    return results;
  }
}
function permitted(tags: any) {
  return (
    !['no', 'private'].includes(tags?.access) && tags?.foot !== 'no' && tags?.disused !== 'yes'
  );
}
function normalizedPaths(geometry: any): [number, number][][] {
  if (geometry?.type === 'LineString') return [geometry.coordinates];
  if (geometry?.type === 'MultiLineString') return geometry.coordinates;
  return [];
}
export async function buildDistrict(district: DistrictId, includeOsm = true): Promise<CityDataset> {
  const config = DISTRICTS[district];
  const label = `TX-${String(config.number).padStart(2, '0')}`;
  const cacheDir = new URL(`../work/${district}-raw/`, import.meta.url);
  await mkdir(cacheDir, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const meta = await json(`${DISTRICT}?f=json`);
  if (meta.name !== '119th Congressional Districts')
    throw new Error('Census layer changed; select the 119th Congress explicitly.');
  const raw = await cached(cacheDir, 'district119', () =>
    json(
      `${DISTRICT}/query?${new URLSearchParams({ f: 'geojson', where: `GEOID='${config.geoid}'`, outFields: 'GEOID,CDSESSN,NAME,CD119', outSR: '4326', returnGeometry: 'true', geometryPrecision: '6', maxAllowableOffset: '0.00003' })}`,
    ),
  );
  if (
    raw.features?.length !== 1 ||
    raw.features[0].properties.CDSESSN !== '119' ||
    raw.features[0].properties.GEOID !== config.geoid
  )
    throw new Error(`Missing exact 119th Congress ${label} boundary`);
  const boundary = geometryPolygons(raw.features[0].geometry),
    bounds = polygonBounds(boundary),
    clipLines = lineClipper(boundary);
  const countiesRaw = await cached(cacheDir, 'counties', () =>
    json(
      `${COUNTIES}/query?${new URLSearchParams({ f: 'geojson', where: `STATE='48' AND BASENAME IN (${config.counties.map((v) => `'${v}'`).join(',')})`, outFields: 'GEOID,BASENAME', outSR: '4326', returnGeometry: 'true', geometryPrecision: '6', maxAllowableOffset: '0.00003' })}`,
    ),
  );
  if (countiesRaw.features?.length !== config.counties.length || countiesRaw.exceededTransferLimit)
    throw new Error('County response incomplete');
  const regions: CoverageRegion[] = countiesRaw.features
    .map((f: any) => {
      const p = intersectPolygons(boundary, geometryPolygons(f.geometry));
      if (!p.length) throw new Error(`County ${f.properties.BASENAME} did not intersect district`);
      return {
        id: f.properties.GEOID,
        name: f.properties.BASENAME,
        polygons: p,
        bounds: polygonBounds(p),
        partial: polygonArea(p) / polygonArea(geometryPolygons(f.geometry)) < 0.99999,
        pinCount: 0,
        parkCount: 0,
        trailCount: 0,
      };
    })
    .sort((a: CoverageRegion, b: CoverageRegion) => a.name.localeCompare(b.name));
  const sections = districtSections(boundary);
  const sources: CityDataset['sources'] = [
    { name: `U.S. Census · 119th Congress ${label} (BAS 2026)`, url: DISTRICT, records: 1 },
    {
      name: `U.S. Census · ${regions.length} intersecting Texas counties`,
      url: COUNTIES,
      records: regions.length,
    },
  ];
  console.log(
    `${label} boundary and counties verified`,
    JSON.stringify({ bounds, counties: regions.map((r) => r.name), sections: sections.length }),
  );
  // allFeatures appends query parameters, so inject the spatial filter into its loader instead.
  const spatialLoader = (url: string) => {
    const q = new URL(url);
    q.searchParams.set('geometry', bounds.join(','));
    q.searchParams.set('geometryType', 'esriGeometryEnvelope');
    q.searchParams.set('inSR', '4326');
    q.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
    return json(q.toString());
  };
  const stateParks = await cached(cacheDir, 'tpwd-parks', () =>
    allFeatures(TPWD_PARKS, 'OBJECTID,ParkName', '1=1', true, spatialLoader),
  );
  const stateTrails = await cached(cacheDir, 'tpwd-trails', () =>
    allFeatures(
      TPWD_TRAILS,
      'OBJECTID,ParkName,Official,Name1,TrailUse',
      "Official='Yes'",
      false,
      spatialLoader,
    ),
  );
  const structures = await cached(cacheDir, 'tpwd-shelters', () =>
    allFeatures(
      TPWD_STRUCTURES,
      'OBJECTID,ParkName,Descriptor',
      "Descriptor IN ('Pavilion','Fish Cleaning Shelter')",
      false,
      spatialLoader,
    ),
  );
  const publicParks = await cached(cacheDir, 'padus-parks', () =>
    allFeatures(
      PADUS,
      'OBJECTID,Unit_Nm,DesTp_Desc,Pub_Access',
      "Pub_Access='OA' AND DesTp_Desc IN ('Local Park','Local Recreation Area','State Park')",
      true,
      spatialLoader,
    ),
  );
  const localityShapes: { id: string; name: string; polygons: PolygonCoordinates }[] = [];
  for (const layer of [11, 12]) {
    const rawPlaces = await cached(cacheDir, `places-${layer}`, () =>
      allFeatures(
        `${PLACES}/${layer}`,
        'OBJECTID,GEOID,BASENAME',
        "STATE='48'",
        true,
        spatialLoader,
      ),
    );
    for (const f of rawPlaces) {
      const shape = intersectPolygons(boundary, geometryPolygons(f.geometry));
      if (shape.length)
        localityShapes.push({
          id: f.properties.GEOID,
          name: f.properties.BASENAME,
          polygons: shape,
        });
    }
  }
  const localities = localityShapes
    .map((p) => ({ id: p.id, name: p.name, bounds: polygonBounds(p.polygons), pinCount: 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  sources.push({
    name: 'U.S. Census · incorporated places and census designated communities (BAS 2026)',
    url: PLACES,
    records: localities.length,
  });
  const parks: MappedPark[] = [],
    trails: ReliefTrail[] = [],
    pins: ReliefPin[] = [];
  const cachedOsmBases: string[] = [];
  for (const f of publicParks) {
    const shape = intersectPolygons(boundary, geometryPolygons(f.geometry));
    if (shape.length)
      parks.push({
        id: `padus-${f.properties.OBJECTID}`,
        name: f.properties.Unit_Nm || 'Mapped public park',
        polygons: shape,
        sourceUrl: PADUS,
      });
  }
  for (const f of structures) {
    const latitude = f.geometry?.y,
      longitude = f.geometry?.x;
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !insidePolygons(longitude, latitude, boundary)
    )
      continue;
    pins.push({
      id: `municipal-tpwd-${f.attributes.OBJECTID}`,
      name: `${f.attributes.ParkName} · ${f.attributes.Descriptor}`,
      parkName: f.attributes.ParkName,
      latitude,
      longitude,
      kind: 'shade',
      feature: 'shelter',
      provenance: 'municipal',
      source: 'Texas Parks & Wildlife · mapped public shelter; access and shade unverified',
      sourceUrl: TPWD_STRUCTURES,
      official: false,
      status: 'unknown',
      updatedAt: fetchedAt,
      confirmations: 0,
      reports: 0,
    });
  }
  for (const f of stateParks) {
    const p = intersectPolygons(boundary, geometryPolygons(f.geometry));
    if (p.length)
      parks.push({
        id: `tpwd-park-${f.properties.OBJECTID}`,
        name: `${f.properties.ParkName} State Park`,
        polygons: p,
        sourceUrl: TPWD_PARKS,
      });
  }
  for (const f of stateTrails) {
    if (!String(f.attributes.TrailUse).includes('Hiking')) continue;
    const paths = clipLines(f.geometry?.paths ?? []);
    if (paths.length)
      trails.push({
        id: `tpwd-trail-${f.attributes.OBJECTID}`,
        name: f.attributes.Name1 || 'State park hiking trail',
        parkName: f.attributes.ParkName,
        paths,
        source: 'Texas Parks & Wildlife · designated hiking trails; closures unverified',
        sourceUrl: TPWD_TRAILS,
      });
  }
  sources.push(
    {
      name: 'USGS PAD-US · open-access parks and recreation areas',
      url: PADUS,
      records: publicParks.length,
    },
    {
      name: 'Texas Parks & Wildlife · public pavilions and shelters',
      url: TPWD_STRUCTURES,
      records: structures.length,
    },
    {
      name: 'Texas Parks & Wildlife · state park boundaries',
      url: TPWD_PARKS,
      records: stateParks.length,
    },
    {
      name: 'Texas Parks & Wildlife · designated trails',
      url: TPWD_TRAILS,
      records: stateTrails.length,
    },
  );
  for (const city of ['arlington', 'dallas']) {
    const seed = JSON.parse(
      await readFile(new URL(`../src/data/${city}.json`, import.meta.url), 'utf8'),
    ) as CityDataset;
    for (const p of seed.pins)
      if (
        (p.provenance === 'municipal' || !includeOsm) &&
        insidePolygons(p.longitude, p.latitude, boundary)
      )
        pins.push(p);
    for (const p of seed.parks) {
      const shape = intersectPolygons(boundary, p.polygons);
      if (shape.length) parks.push({ ...p, polygons: shape });
    }
    for (const t of seed.trails) {
      const paths = clipLines(t.paths);
      if (paths.length) trails.push({ ...t, paths });
    }
    sources.push({
      name: `${seed.name} municipal snapshot · collected ${new Date(seed.fetchedAt).toLocaleDateString('en-US', { timeZone: 'America/Chicago' })}`,
      url: seed.sources.find((s) => s.name.includes('park polygons'))!.url,
      records: seed.parks.length,
    });
    if (!includeOsm) {
      const base = seed.sources
        .find((s) => s.name.includes('(database '))
        ?.name.match(/database ([^)]+)/)?.[1];
      if (base) cachedOsmBases.push(base);
    }
  }
  const amenities = new Map<string, any>(),
    geometries = new Map<string, any>(),
    bases: string[] = [],
    providers = new Set<string>();
  let completed = 0,
    emptySections = 0;
  for (const part of includeOsm ? sections : []) {
    let size = 0;
    for (const kind of ['amenities', 'geometry'] as const) {
      const results = await section(part.bounds, kind, cacheDir);
      for (const d of results) {
        if (d.base) bases.push(d.base);
        providers.add(d.provider);
        size += d.elements.length;
        for (const e of d.elements)
          (kind === 'amenities' ? amenities : geometries).set(`${e.type}/${e.id}`, e);
      }
    }
    completed++;
    if (!size) emptySections++;
    console.log(`${label} section ${completed}/${sections.length} complete`, part.id, size);
  }
  const osmPins = normalizeOsmPins([...amenities.values()], fetchedAt).filter((p) =>
    insidePolygons(p.longitude, p.latitude, boundary),
  );
  const features = osmToGeoJSON(
    { elements: [...geometries.values()] },
    { flatProperties: false },
  ).features;
  for (const f of features) {
    const tags = f.properties?.tags ?? {};
    if (!permitted(tags) || f.properties?.tainted) continue;
    const name = tags.name || tags.ref;
    if (['park', 'nature_reserve'].includes(tags.leisure)) {
      const shape = geometryPolygons(f.geometry);
      if (!shape.length) continue;
      const clipped = intersectPolygons(boundary, shape);
      if (!clipped.length) continue;
      const keyName = (v: string) =>
        v
          .toLowerCase()
          .replace(/\b(state|park|nature|preserve)\b/g, '')
          .replace(/[^a-z0-9]/g, '');
      if (name && parks.some((p) => keyName(p.name) === keyName(name))) continue;
      parks.push({
        id: `osm-${f.id}`,
        name: name || 'Mapped park / preserve',
        polygons: clipped,
        sourceUrl: `https://www.openstreetmap.org/${f.id}`,
      });
    } else if (
      ['path', 'footway', 'cycleway'].includes(tags.highway) &&
      !['sidewalk', 'crossing'].includes(tags.footway)
    ) {
      const paths = clipLines(normalizedPaths(f.geometry));
      if (!paths.length) continue;
      const centre = paths[0]![0]!,
        park = parks.find((p) => insidePolygons(centre[0], centre[1], p.polygons));
      if (park?.id.startsWith('tpwd-')) continue;
      trails.push({
        id: `osm-trail-${f.id}`,
        name: name || (park ? `${park.name} · path` : 'Mapped walking / cycling path'),
        parkName: park?.name,
        paths,
        source: 'OpenStreetMap · mapped path; access and closures unverified',
        sourceUrl: `https://www.openstreetmap.org/${f.id}`,
      });
    }
  }
  for (const p of osmPins) {
    if (pins.some((c) => c.kind === p.kind && distanceMeters(p, c) < 15)) continue;
    const park = parks.find((park) => insidePolygons(p.longitude, p.latitude, park.polygons));
    if (park) {
      p.parkName = park.name;
      if (!p.name.includes(park.name)) p.name = `${park.name} · ${p.name}`;
    }
    pins.push(p);
  }
  for (const p of pins) {
    const region = regions.find((r) => insidePolygons(p.longitude, p.latitude, r.polygons));
    if (region) {
      p.regionName = region.name;
      region.pinCount++;
    }
    const locality = localityShapes.find((l) =>
      insidePolygons(p.longitude, p.latitude, l.polygons),
    );
    if (locality) {
      p.localityName = locality.name;
      localities.find((l) => l.id === locality.id)!.pinCount++;
    }
  }
  for (const p of parks) {
    const names = regions.filter((r) => intersectPolygons(p.polygons, r.polygons).length);
    p.regionName = names.map((r) => r.name).join(', ');
    names.forEach((r) => r.parkCount++);
    const locality = localityShapes.find((l) => intersectPolygons(p.polygons, l.polygons).length);
    p.localityName = locality?.name;
  }
  const regionClippers = regions.map((region) => ({ region, clip: lineClipper(region.polygons) }));
  for (const t of trails) {
    const intersecting = regionClippers.filter(({ clip }) => clip(t.paths).length);
    t.regionName = intersecting.map(({ region }) => region.name).join(', ');
    intersecting.forEach(({ region }) => region.trailCount++);
    t.localityName = localityShapes.find((l) =>
      t.paths.some((path) => insidePolygons(path[0]![0], path[0]![1], l.polygons)),
    )?.name;
  }
  const base = bases.sort()[0] ?? 'unavailable';
  if (!includeOsm)
    sources.push({
      name: `OpenStreetMap cached DFW markers (database ${cachedOsmBases.sort()[0] ?? 'unavailable'})`,
      url: 'https://www.openstreetmap.org/copyright',
      records: pins.filter((p) => p.provenance === 'osm').length,
    });
  if (includeOsm)
    sources.push({
      name: `OpenStreetMap district features (database ${base})`,
      url: 'https://www.openstreetmap.org/copyright',
      records: amenities.size + geometries.size,
    });
  const sectionPolygons = sections.map((s) => rectangle(s.bounds));
  const uncovered = polygonClipping.difference(boundary, ...sectionPolygons) as PolygonCoordinates;
  const coverage = 1 - polygonArea(uncovered) / polygonArea(boundary);
  if (includeOsm && (completed !== sections.length || coverage < 0.999999))
    throw new Error('District query coverage incomplete');
  await writeFile(
    new URL('manifest.json', cacheDir),
    JSON.stringify(
      {
        fetchedAt,
        boundaryVersion: '119th Congress / Census BAS 2026',
        sections,
        completed,
        providers: [...providers],
        oldestOsmBase: base,
      },
      null,
      2,
    ),
  );
  return {
    city: district,
    name: `Texas Congressional District ${config.number}`,
    areaType: 'congressional-district',
    boundaryLabel: `${label} · 119th Congress`,
    boundaryVersion: '119th Congress (2025–2027) · Census BAS 2026',
    boundary,
    bounds,
    boundarySource: DISTRICT,
    fetchedAt,
    regions,
    localities,
    coverage: {
      status: includeOsm ? 'complete' : 'baseline',
      completedSections: completed,
      totalSections: sections.length,
      emptySections,
      boundaryCoverage: includeOsm ? coverage : 0,
    },
    pins,
    parks,
    trails,
    sources,
    warnings: [
      includeOsm
        ? 'District-wide geographic queries completed. Published records may omit fountains, shelters and paths; empty areas do not prove that no amenities exist.'
        : 'The full district boundary, communities, and available official park/trail layers are included. District-wide OpenStreetMap collection is incomplete; cached DFW amenity records remain dated. Fountain and shade coverage is incomplete.',
      `119th Congress ${label} boundary (2025–2027). The 2026 election / 120th Congress map is a separate boundary version.`,
      'Park boundaries are clipped to the district and are not shade measurements. Wooded areas indicate potential shade; water flow, hours, closures and public access remain unverified.',
    ],
  };
}
export async function refreshDistrict(district: DistrictId, includeOsm = true) {
  const d = await buildDistrict(district, includeOsm);
  const target = new URL(`../src/data/${district}.json`, import.meta.url),
    temp = new URL(`../src/data/${district}.pending`, import.meta.url);
  await writeFile(temp, JSON.stringify(d));
  await rename(temp, target);
  console.log(
    `${district.toUpperCase()} snapshot saved`,
    JSON.stringify({
      pins: d.pins.length,
      water: d.pins.filter((p) => p.kind === 'water').length,
      shade: d.pins.filter((p) => p.kind === 'shade').length,
      parks: d.parks.length,
      trails: d.trails.length,
      regions: d.regions?.map((r) => ({
        name: r.name,
        pins: r.pinCount,
        parks: r.parkCount,
        trails: r.trailCount,
      })),
      coverage: d.coverage,
    }),
  );
}
