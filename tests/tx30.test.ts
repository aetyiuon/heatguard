import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundledCity, insidePolygons } from '../src/domain/cities';
import { handleRequest } from '../backend/app';
import { lineClipper, polygonArea } from '../scripts/district-geometry';
import { polygonClipping } from '../scripts/geometry-vendor';

test('TX-30 uses the current 119th Congress boundary, both county portions, and southern DFW community portions', async () => {
  const d = await bundledCity('tx30');
  assert.equal(d.city, 'tx30');
  assert.equal(d.areaType, 'congressional-district');
  assert.equal(d.name, 'Texas Congressional District 30');
  assert.equal(d.boundaryLabel, 'TX-30 · 119th Congress');
  assert.match(d.boundaryVersion!, /119th Congress/);
  assert.deepEqual(
    d.regions?.map((r) => r.name),
    ['Dallas', 'Tarrant'],
  );
  assert.ok(d.regions!.every((r) => r.partial));
  for (const name of [
    'Dallas',
    'Arlington',
    'Grand Prairie',
    'Cedar Hill',
    'DeSoto',
    'Duncanville',
    'Lancaster',
    'Hutchins',
    'Wilmer',
    'Seagoville',
  ]) {
    assert.ok(
      d.localities?.some((l) => l.name === name),
      name,
    );
  }
  assert.ok(d.bounds[0] < -97.08 && d.bounds[0] > -97.1);
  assert.ok(d.bounds[2] > -96.54 && d.bounds[2] < -96.52);
  assert.ok(d.bounds[1] < 32.55 && d.bounds[3] > 32.85);
  assert.equal(
    insidePolygons(-97.116, 32.7902, d.boundary),
    false,
    'River Legacy Park belongs to a different map area',
  );
  const uncovered = polygonClipping.difference(d.boundary, ...d.regions!.map((r) => r.polygons));
  assert.ok(polygonArea(uncovered) / polygonArea(d.boundary) < 0.0001);
});

test('TX-30 retains real source records, filters every pin to the district, and never invents working status', async () => {
  const d = await bundledCity('tx30');
  assert.ok(d.pins.length > 500);
  assert.ok(d.pins.filter((p) => p.kind === 'water').length > 100);
  assert.ok(d.pins.filter((p) => p.kind === 'shade').length > 400);
  assert.equal(new Set(d.pins.map((p) => p.id)).size, d.pins.length);
  for (const p of d.pins) {
    assert.ok(insidePolygons(p.longitude, p.latitude, d.boundary), p.id);
    assert.equal(p.status, 'unknown');
    assert.equal(p.official, false);
    assert.ok(p.sourceUrl, p.id);
    assert.ok(p.regionName && d.regions!.some((r) => r.name === p.regionName), p.id);
  }
  for (const region of d.regions!) {
    assert.equal(region.pinCount, d.pins.filter((p) => p.regionName === region.name).length);
  }
});

test('TX-30 park polygons and trail segments stop at the district boundary', async () => {
  const d = await bundledCity('tx30');
  assert.ok(d.parks.length > 250);
  assert.ok(d.trails.length > 100);
  assert.ok(d.parks.some((p) => /Cedar Hill State Park/i.test(p.name)));
  for (const p of d.parks) {
    assert.ok(p.polygons.length, p.id);
    assert.ok(polygonArea(polygonClipping.difference(p.polygons, d.boundary)) < 1e-8, p.id);
  }
  for (const t of d.trails)
    for (const path of t.paths)
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!,
          b = path[i]!;
        assert.ok(insidePolygons((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, d.boundary), t.id);
      }
});

test('TX-30 county filters retain crossing trails and match the published county counts', async () => {
  const d = await bundledCity('tx30');
  for (const region of d.regions!) {
    const clip = lineClipper(region.polygons);
    const actual = d.trails.filter((t) => clip(t.paths).length);
    assert.equal(region.trailCount, actual.length);
    for (const t of actual) assert.ok(t.regionName?.split(', ').includes(region.name), t.id);
  }
});

test('TX-30 labels incomplete collection and keeps the original timestamps of cached OSM records', async () => {
  const d = await bundledCity('tx30');
  const c = d.coverage!;
  if (c.status === 'baseline') {
    assert.equal(c.completedSections, 0);
    assert.equal(c.boundaryCoverage, 0);
    assert.ok(d.warnings.some((w) => /incomplete/i.test(w)));
    assert.ok(
      d.pins
        .filter((p) => p.provenance === 'osm')
        .every((p) => Date.parse(p.updatedAt) < Date.parse(d.fetchedAt)),
    );
  } else {
    assert.equal(c.completedSections, c.totalSections);
    assert.ok(c.boundaryCoverage > 0.999999);
  }
  assert.ok(d.sources.some((s) => s.name.includes('USGS')));
  assert.ok(d.sources.some((s) => s.name.includes('Texas Parks')));
});

test('district API distinguishes TX-30 from TX-06 and rejects unsupported or conflicting district scopes', async () => {
  const d = await bundledCity('tx30');
  const r = await handleRequest(
    new Request('https://test/relief?district=tx30', {
      headers: { Origin: 'http://localhost:8081' },
    }),
  );
  const body = await r.json();
  assert.equal(r.status, 200);
  assert.equal(body.city, 'tx30');
  assert.equal(body.regions.length, 2);
  assert.equal(body.localities.length, d.localities!.length);
  assert.equal(body.pins.length, d.pins.length);
  assert.equal(body.fetchedAt, d.fetchedAt);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  const six = await handleRequest(new Request('https://test/relief?district=tx06'));
  assert.equal((await six.json()).city, 'tx06');
  for (const query of [
    'district=30',
    'district=tx31',
    'district=tx30&city=dallas',
    'district=tx30&city=arlington',
  ]) {
    assert.equal((await handleRequest(new Request('https://test/relief?' + query))).status, 400);
  }
});
