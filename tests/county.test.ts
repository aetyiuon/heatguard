import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledCity, insidePolygons } from '../src/domain/cities';
import { handleRequest } from '../backend/app';
import { lineClipper, polygonArea, rectangle } from '../scripts/district-geometry';
import { polygonClipping } from '../scripts/geometry-vendor';
import {
  countyTrails,
  NCTCOG_TRAILS,
  garlandShelters,
  GARLAND_PAVILIONS,
} from '../scripts/county-sources';

test('Garland shelter pins require a published pavilion footprint and retain edit dates and uncertainty', () => {
  const fetchedAt = '2026-10-23T17:00:00Z';
  const raw = {
    attributes: {
      OBJECTID: 1,
      FACILITY_TYPE: 26,
      FACILITY_NAME: 'Test pavilion',
      last_edited_date: Date.parse('2023-07-31T00:00:00Z'),
    },
    geometry: {
      rings: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
          [0, 0],
        ],
      ],
    },
  };
  const pins = garlandShelters(
    [
      raw,
      { ...raw, attributes: { ...raw.attributes, FACILITY_TYPE: 99 } },
      { ...raw, attributes: { ...raw.attributes, FACILITY_NAME: 'Removed pavilion' } },
      { ...raw, attributes: { ...raw.attributes, FACILITY_NAME: 'Pavilion pad' } },
      { ...raw, attributes: { ...raw.attributes, FACILITY_NAME: 'Proposed pavilion' } },
    ],
    fetchedAt,
  );
  assert.equal(pins.length, 1);
  assert.equal(pins[0]!.kind, 'shade');
  assert.equal(pins[0]!.status, 'unknown');
  assert.equal(pins[0]!.official, false);
  assert.equal(pins[0]!.approximateLocation, true);
  assert.equal(pins[0]!.longitude, 0.5);
  assert.equal(pins[0]!.sourceUpdatedAt, '2023-07-31T00:00:00.000Z');
  assert.equal(pins[0]!.updatedAt, fetchedAt);
  assert.equal(pins[0]!.sourceUrl, GARLAND_PAVILIONS);
  assert.throws(
    () =>
      garlandShelters(
        [
          {
            ...raw,
            geometry: {
              rings: [
                [
                  [999, 1],
                  [1, 1],
                  [1, 2],
                  [999, 1],
                ],
              ],
            },
          },
        ],
        fetchedAt,
      ),
    /Invalid/,
  );
});
import { allFeatures, spatialQueryLoader } from '../scripts/refresh-cities';

test('spatial ingestion retrieves all advertised IDs without a second spatial filter dropping coarse-index hits', async () => {
  const loader = spatialQueryLoader([0, 0, 1, 1], async (url) => {
    const params = new URL(url).searchParams;
    if (params.has('returnIdsOnly')) {
      assert.equal(params.get('geometry'), '0,0,1,1');
      return { objectIdFieldName: 'OBJECTID', objectIds: [1, 2] };
    }
    assert.equal(params.has('geometry'), false);
    assert.equal(params.get('objectIds'), '1,2');
    return { features: [{ attributes: { OBJECTID: 1 } }, { attributes: { OBJECTID: 2 } }] };
  });
  assert.equal((await allFeatures('https://test/0', 'OBJECTID', '1=1', false, loader)).length, 2);
});

test('Dallas County includes communities beyond Dallas city and excludes neighboring counties', async () => {
  const county = await bundledCity('dallas-county');
  assert.equal(county.areaType, 'county');
  assert.match(county.boundaryVersion!, /48113/);
  const city = await bundledCity('dallas');
  for (const point of [
    [-96.9489, 32.814],
    [-96.6389, 32.9126],
    [-96.5992, 32.7668],
  ]) {
    assert.ok(insidePolygons(point[0]!, point[1]!, county.boundary));
    assert.equal(insidePolygons(point[0]!, point[1]!, city.boundary), false);
  }
  for (const point of [
    [-97.116, 32.7902],
    [-96.698, 33.02],
    [-96.459, 32.932],
  ])
    assert.equal(insidePolygons(point[0]!, point[1]!, county.boundary), false);
  for (const name of [
    'Dallas',
    'Irving',
    'Garland',
    'Richardson',
    'Mesquite',
    'Lancaster',
    'Wilmer',
    'Coppell',
    'DeSoto',
    'Duncanville',
  ])
    assert.ok(
      county.localities?.some((l) => l.name === name),
      name,
    );
});

test('community filters and remaining county areas cover the whole county with accurate counts', async () => {
  const county = await bundledCity('dallas-county');
  const regions = county.regions!;
  assert.ok(regions.length > 20);
  assert.ok(regions.some((r) => r.id === '48113-unincorporated'));
  // Check the complement separately: combining every community with its already
  // computed complement hits the vendor's coincident-edge precision limit.
  const other = regions.find((r) => r.id === '48113-unincorporated')!;
  const remaining = polygonClipping.difference(
    county.boundary,
    ...regions.filter((r) => r !== other).map((r) => r.polygons),
  );
  assert.ok(Math.abs(polygonArea(remaining) - polygonArea(other.polygons)) < 1e-10);
  assert.ok(polygonArea(polygonClipping.difference(remaining, other.polygons)) < 1e-10);
  for (const region of regions) {
    assert.ok(polygonArea(polygonClipping.difference(region.polygons, county.boundary)) < 1e-8);
    assert.equal(region.pinCount, county.pins.filter((p) => p.regionName === region.name).length);
    assert.equal(
      region.parkCount,
      county.parks.filter((p) => p.regionName?.split(', ').includes(region.name)).length,
    );
    assert.equal(
      region.trailCount,
      county.trails.filter((t) => t.regionName?.split(', ').includes(region.name)).length,
    );
  }
  assert.equal(
    regions.reduce((sum, r) => sum + r.pinCount, 0),
    county.pins.length,
  );
});

test('county pins retain real provenance and source timestamps without claiming verified facilities', async () => {
  const county = await bundledCity('dallas-county');
  assert.ok(county.pins.length > 1000);
  assert.ok(
    county.pins
      .filter((p) => p.sourceUrl === GARLAND_PAVILIONS)
      .every((p) => !/\bpad\b/i.test(p.name)),
  );
  assert.ok(
    county.pins.filter((p) => p.sourceUrl === GARLAND_PAVILIONS && p.regionName === 'Garland')
      .length >= 20,
  );
  assert.equal(new Set(county.pins.map((p) => p.id)).size, county.pins.length);
  for (const pin of county.pins) {
    assert.ok(insidePolygons(pin.longitude, pin.latitude, county.boundary), pin.id);
    assert.equal(pin.status, 'unknown');
    assert.equal(pin.official, false);
    assert.ok(pin.sourceUrl);
    assert.ok(pin.regionName);
  }
  if (county.coverage?.status === 'baseline') {
    const original = new Map((await bundledCity('dallas')).pins.map((p) => [p.id, p]));
    for (const pin of county.pins.filter((p) => p.provenance === 'osm'))
      assert.equal(pin.updatedAt, original.get(pin.id)?.updatedAt, pin.id);
    assert.equal(county.coverage.completedSections, 0);
    assert.equal(county.coverage.boundaryCoverage, 0);
    assert.match(county.warnings[0]!, /incomplete/i);
  }
});

test('county parks and crossing trail segments are clipped to the actual county polygon', async () => {
  const county = await bundledCity('dallas-county');
  assert.ok(county.parks.length > 400);
  assert.ok(county.trails.some((t) => t.sourceUrl === NCTCOG_TRAILS));
  for (const park of county.parks)
    assert.ok(
      polygonArea(polygonClipping.difference(park.polygons, county.boundary)) < 1e-8,
      park.id,
    );
  for (const trail of county.trails)
    for (const path of trail.paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!,
          b = path[i]!;
        assert.ok(insidePolygons((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, county.boundary), trail.id);
      }
  for (const name of ['Garland', 'Irving', 'Mesquite'])
    assert.ok(county.regions!.find((r) => r.name === name)!.trailCount > 0, name);
});

test('regional adapter excludes proposed, on-street, pending and out-of-county alignments', () => {
  const raw = {
    attributes: {
      OBJECTID: 1,
      Name: 'Crossing path',
      Status: 'Existing',
      OnOffStr: 'Off-Street',
      AlignPend: 'No',
    },
    geometry: {
      paths: [
        [
          [-2, 0.5],
          [2, 0.5],
        ],
      ],
    },
  };
  const clip = lineClipper(rectangle([0, 0, 1, 1]));
  const change = (attributes: object) => ({
    ...raw,
    attributes: { ...raw.attributes, ...attributes },
  });
  const trails = countyTrails(
    [
      raw,
      change({ Status: 'Planned' }),
      change({ Status: 'Funded' }),
      change({ OnOffStr: 'On-Street' }),
      change({ AlignPend: 'Yes' }),
    ],
    clip,
  );
  assert.equal(trails.length, 1);
  assert.deepEqual(trails[0]!.paths, [
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ]);
  assert.equal(trails[0]!.sourceUrl, NCTCOG_TRAILS);
  assert.deepEqual(
    countyTrails(
      [
        {
          ...raw,
          geometry: {
            paths: [
              [
                [2, 2],
                [3, 3],
              ],
            ],
          },
        },
      ],
      clip,
    ),
    [],
  );
  assert.throws(
    () =>
      countyTrails(
        [
          {
            ...raw,
            geometry: {
              paths: [
                [
                  [2000000, 7000000],
                  [2, 3],
                ],
              ],
            },
          },
        ],
        clip,
      ),
    /Invalid/,
  );
});

test('county API preserves dataset metadata, remains distinct from city scope, and rejects ambiguous scopes', async () => {
  const county = await bundledCity('dallas-county');
  const response = await handleRequest(
    new Request('https://test/relief?county=dallas', {
      headers: { Origin: 'http://localhost:8081' },
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  const data = await response.json();
  assert.equal(data.city, 'dallas-county');
  assert.equal(data.pins.length, county.pins.length);
  assert.equal(data.trails.length, county.trails.length);
  assert.equal(data.fetchedAt, county.fetchedAt);
  assert.deepEqual(data.coverage, county.coverage);
  assert.equal(
    (await (await handleRequest(new Request('https://test/relief?city=dallas'))).json()).city,
    'dallas',
  );
  for (const query of [
    'county=',
    'county=tarrant',
    'county=48113',
    'county=dallas&city=dallas',
    'county=dallas&district=tx30',
    'county=dallas&district=',
    'county=&city=dallas',
    'county=dallas&county=tarrant',
    'county=dallas&county=dallas',
  ])
    assert.equal(
      (await handleRequest(new Request('https://test/relief?' + query))).status,
      400,
      query,
    );
});
