import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledCity, insidePolygons } from '../src/domain/cities';
import { handleRequest } from '../backend/app';
import { fortWorthPins } from '../backend/fort-worth';
import { lineClipper } from '../src/domain/paths';

test('Fort Worth published amenities and every trail vertex stay inside the full city polygon', async () => {
  const fw = await bundledCity('fort-worth');
  assert.equal(fw.areaType, 'city');
  assert.ok(fw.pins.length > 300);
  assert.ok(fw.trails.length > 200);
  assert.ok(fw.parks.length > 300);
  assert.ok(
    fw.pins.every(
      (p) =>
        insidePolygons(p.longitude, p.latitude, fw.boundary) &&
        p.status === 'unknown' &&
        !p.official,
    ),
  );
  assert.ok(
    fw.trails.every((t) =>
      t.paths.every((path) => path.every(([x, y]) => insidePolygons(x, y, fw.boundary))),
    ),
  );
  assert.deepEqual(
    fw.regions?.map((r) => r.id),
    ['tx06'],
  );
});
test('city district portions are actual intersections and shared clipping excludes outside trail spans', async () => {
  for (const id of ['arlington', 'dallas', 'fort-worth'] as const) {
    const city = await bundledCity(id);
    assert.equal(city.areaType, 'city');
    for (const region of city.regions ?? []) {
      const district = await bundledCity(region.id as 'tx06' | 'tx30');
      assert.ok(
        region.polygons
          .flat(2)
          .every(
            ([x, y]) =>
              insidePolygons(x, y, city.boundary) && insidePolygons(x, y, district.boundary),
          ),
      );
      const clipped = lineClipper(region.polygons)(city.trails.flatMap((t) => t.paths));
      assert.ok(
        clipped.every((path) => path.every(([x, y]) => insidePolygons(x, y, region.polygons))),
      );
    }
  }
});
test('all mapped entries preserves every source pin and every clipped geometry fragment', async () => {
  const combined = await bundledCity('all-dfw'),
    ids = new Set(combined.pins.map((p) => p.id));
  assert.equal(ids.size, combined.pins.length);
  const trails = new Map(combined.trails.map((t) => [t.id, t]));
  for (const area of [
    'arlington',
    'dallas',
    'fort-worth',
    'dallas-county',
    'tx06',
    'tx30',
  ] as const) {
    const source = await bundledCity(area);
    assert.ok(source.pins.every((p) => ids.has(p.id)));
    assert.ok(
      source.trails.every((t) =>
        t.paths.every((path) =>
          trails.get(t.id)?.paths.some((p) => JSON.stringify(p) === JSON.stringify(path)),
        ),
      ),
    );
  }
});
test('Fort Worth normalization rejects invalid geometry and excludes retired assets', () => {
  const feature = {
    attributes: { OBJECTID: 12, ASSETID: 'F12', PARK: 'Synthetic park' },
    geometry: { x: -97.3, y: 32.7 },
  };
  const p = fortWorthPins([feature], 10, '2026-10-24T00:00:00Z')[0]!;
  assert.equal(p.kind, 'water');
  assert.equal(p.status, 'unknown');
  assert.equal(p.official, false);
  assert.equal(
    fortWorthPins(
      [{ ...feature, attributes: { ...feature.attributes, CONDITION: 'Retired' } }],
      25,
      p.updatedAt,
    ).length,
    0,
  );
  assert.throws(() =>
    fortWorthPins([{ ...feature, geometry: { x: Infinity, y: 32 } }], 10, p.updatedAt),
  );
});
test('API accepts Fort Worth and combined entries but still rejects conflicting/repeated scopes', async () => {
  for (const city of ['fort-worth', 'all-dfw']) {
    const r = await handleRequest(new Request(`https://heatguard.test/relief?city=${city}`), {});
    assert.equal(r.status, 200);
    assert.equal(((await r.json()) as any).city, city);
  }
  for (const query of ['city=fort-worth&district=tx06', 'city=fort-worth&city=dallas'])
    assert.equal(
      (await handleRequest(new Request(`https://heatguard.test/relief?${query}`), {})).status,
      400,
    );
});
