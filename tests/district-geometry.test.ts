import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polygonClipping, osmToGeoJSON } from '../scripts/geometry-vendor';
import {
  districtSections,
  intersectPolygons,
  lineClipper,
  polygonArea,
  rectangle,
} from '../scripts/district-geometry';
import { insidePolygons } from '../src/domain/cities';
import { PolygonCoordinates } from '../src/domain/types';

test('district park clipping preserves holes and excludes the out-of-district part', () => {
  const district: PolygonCoordinates = [...rectangle([0, 0, 10, 10])];
  district[0]!.push(rectangle([3, 3, 7, 7])[0]![0]!);
  const clipped = intersectPolygons(rectangle([-2, -2, 5, 12]), district);
  assert.equal(polygonArea(clipped), 42);
  assert.equal(insidePolygons(-1, 1, clipped), false);
  assert.equal(insidePolygons(1, 1, clipped), true);
  assert.equal(insidePolygons(4, 4, clipped), false);
  assert.equal(insidePolygons(0, 5, district), true);
  assert.equal(insidePolygons(3, 5, district), true);
});

test('trail clipping keeps boundary crossings even when both original endpoints lie outside', () => {
  const district = rectangle([0, 0, 10, 10]);
  district[0]!.push(rectangle([3, 3, 7, 7])[0]![0]!);
  const paths = lineClipper(district)([
    [
      [-1, 5],
      [11, 5],
    ],
  ]);
  assert.equal(paths.length, 2);
  for (const [a, b] of paths) {
    assert.ok(a && b);
    assert.ok(insidePolygons(a[0], a[1], district));
    assert.ok(insidePolygons(b[0], b[1], district));
  }
  assert.ok(Math.abs(paths[0]![0]![0]) < 1e-9);
  assert.ok(Math.abs(paths[0]!.at(-1)![0] - 3) < 1e-9);
  assert.ok(Math.abs(paths[1]![0]![0] - 7) < 1e-9);
  assert.ok(Math.abs(paths[1]!.at(-1)![0] - 10) < 1e-9);
  assert.equal(
    lineClipper(district)([
      [
        [-3, -2],
        [-1, -1],
      ],
    ]).length,
    0,
  );
});

test('district query sections cover disconnected islands and narrow corridors without querying empty corners', () => {
  const district = polygonClipping.union(
    rectangle([0, 0, 0.9, 0.04]),
    rectangle([0.86, 0, 0.9, 0.9]),
    rectangle([1.1, 1.1, 1.2, 1.2]),
  );
  const sections = districtSections(district, 0.2);
  assert.ok(sections.length < 36);
  assert.ok(sections.every((s) => intersectPolygons(district, rectangle(s.bounds)).length > 0));
  const uncovered = polygonClipping.difference(
    district,
    ...sections.map((s) => rectangle(s.bounds)),
  );
  assert.ok(polygonArea(uncovered) < 1e-10);
});

test('vendored OSM conversion reconstructs geometry from an Overpass way response', () => {
  const d = osmToGeoJSON(
    {
      elements: [
        {
          type: 'way',
          id: 1,
          tags: { leisure: 'park', name: 'Fixture Park' },
          nodes: [1, 2, 3, 4, 1],
          geometry: [
            { lon: 0, lat: 0 },
            { lon: 1, lat: 0 },
            { lon: 1, lat: 1 },
            { lon: 0, lat: 1 },
            { lon: 0, lat: 0 },
          ],
        },
      ],
    },
    { flatProperties: false },
  );
  assert.equal(d.features[0]?.geometry.type, 'Polygon');
  assert.equal(d.features[0]?.properties.tags.name, 'Fixture Park');
});
