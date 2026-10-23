import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allFeatures } from '../scripts/refresh-cities';
import { bundledCity, insidePolygons, polygonBounds } from '../src/domain/cities';
import { PolygonCoordinates } from '../src/domain/types';
import { normalizeArlingtonPins } from '../backend/dfw';
import { handleRequest } from '../backend/app';

test('municipal ingestion retrieves all IDs beyond one page and rejects missing records', async () => {
  const ids = Array.from({ length: 401 }, (_, i) => i + 1);
  const requested: number[] = [];
  const loader = async (url: string) => {
    const q = new URL(url).searchParams;
    if (q.has('returnIdsOnly')) return { objectIds: ids, objectIdFieldName: 'OBJECTID' };
    const batch = q.get('objectIds')!.split(',').map(Number);
    assert.ok(batch.length <= 150);
    requested.push(...batch);
    return { features: batch.map((OBJECTID) => ({ attributes: { OBJECTID } })) };
  };
  assert.equal(
    (await allFeatures('https://example.test/0', 'OBJECTID', '1=1', false, loader)).length,
    401,
  );
  assert.deepEqual(requested, ids);
  await assert.rejects(
    allFeatures('https://example.test/0', 'OBJECTID', '1=1', false, async (url: string) =>
      new URL(url).searchParams.has('returnIdsOnly')
        ? { objectIds: [1, 2], objectIdFieldName: 'OBJECTID' }
        : { features: [{ attributes: { OBJECTID: 1 } }] },
    ),
    /omitted/,
  );
});

test('city containment respects islands and excludes holes rather than treating a bounding box as the city', () => {
  const shape: PolygonCoordinates = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
      [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7],
        [3, 3],
      ],
    ],
    [
      [
        [20, 20],
        [21, 20],
        [21, 21],
        [20, 21],
        [20, 20],
      ],
    ],
  ];
  assert.equal(insidePolygons(1, 1, shape), true);
  assert.equal(insidePolygons(5, 5, shape), false);
  assert.equal(insidePolygons(20.5, 20.5, shape), true);
  assert.equal(insidePolygons(15, 15, shape), false);
  assert.deepEqual(polygonBounds(shape), [0, 0, 21, 21]);
});

test('whole-city Arlington mode keeps southern assets while nearby mode retains its radius', () => {
  const f = {
    attributes: { OBJECTID: 1, ID: 'south', ParkID: 'Southern park' },
    geometry: { x: -97.1, y: 32.61 },
  };
  const place = {
    name: 'River Legacy',
    latitude: 32.79,
    longitude: -97.116,
    emergencyNumber: '911',
  };
  assert.equal(normalizeArlingtonPins([f], 1, place, '2026-10-03T00:00:00Z').length, 0);
  assert.equal(normalizeArlingtonPins([f], 1, place, '2026-10-03T00:00:00Z', true).length, 1);
});

test('city API serves the complete dated dataset without requiring coordinates and validates city names', async () => {
  for (const city of ['arlington', 'dallas'] as const) {
    const r = await handleRequest(
      new Request(`https://test/relief?city=${city}`, {
        headers: { Origin: 'http://localhost:8081' },
      }),
    );
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
    const data = await r.json();
    const bundled = await bundledCity(city);
    assert.equal(data.city, city);
    assert.equal(data.fetchedAt, bundled.fetchedAt);
    assert.equal(data.pins.length, bundled.pins.length);
    assert.equal(data.parks.length, bundled.parks.length);
    assert.equal(data.trails.length, bundled.trails.length);
    assert.deepEqual(data.bounds, bundled.bounds);
  }
  for (const city of ['invalid', '']) {
    assert.equal(
      (await handleRequest(new Request(`https://test/relief?city=${city}`))).status,
      400,
    );
  }
});

for (const city of ['arlington', 'dallas'] as const)
  test(`${city} snapshot spans the whole city and retains source provenance`, async () => {
    const d = await bundledCity(city);
    assert.equal(d.city, city);
    assert.ok(d.bounds[3] - d.bounds[1] > 0.2);
    assert.ok(d.parks.length > 50 && d.trails.length > 50 && d.pins.length > 50);
    assert.equal(new Set(d.pins.map((p) => p.id)).size, d.pins.length);
    assert.equal(
      d.sources.every((s) => s.url.startsWith('https://') && s.records > 0),
      true,
    );
    for (const pin of d.pins) {
      assert.ok(Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude));
      assert.equal(pin.status, 'unknown');
      assert.equal(pin.official, false);
      assert.ok(pin.sourceUrl);
      if (pin.provenance === 'osm')
        assert.equal(insidePolygons(pin.longitude, pin.latitude, d.boundary), true);
    }
    const northern = d.pins.some(
      (p) => p.latitude > d.bounds[1] + (d.bounds[3] - d.bounds[1]) * 0.65,
    );
    const southern = d.pins.some(
      (p) => p.latitude < d.bounds[1] + (d.bounds[3] - d.bounds[1]) * 0.35,
    );
    assert.ok(northern && southern, 'Amenities exist across northern and southern portions');
  });
