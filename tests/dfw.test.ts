import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeArlingtonPins, normalizeArlingtonTrails } from '../backend/dfw';
import { normalizeOsmPins } from '../backend/relief';
import { DFW_PLACES } from '../src/domain/places';
const place = DFW_PLACES[0]!;
const time = '2026-10-03T03:00:00.000Z';
const fountain = {
  attributes: {
    OBJECTID: 577206,
    ID: '4178',
    ParkID: 'River Legacy',
    Inactive: null,
    Retired: null,
    last_edited_date: 1783973714000,
  },
  geometry: { x: -97.11659269448995, y: 32.79015849555742 },
};
test('Arlington fountain retains its actual park/asset label without asserting working water', () => {
  const [p] = normalizeArlingtonPins([fountain], 1, place, time);
  assert.equal(p?.name, 'River Legacy · Drinking fountain #4178');
  assert.equal(p?.status, 'unknown');
  assert.equal(p?.official, false);
  assert.equal(p?.provenance, 'municipal');
  assert.equal(p?.longitude, fountain.geometry.x);
  assert.equal(p?.sourceUpdatedAt, new Date(1783973714000).toISOString());
});
test('retired asset text overrides an empty retirement field; inactive and distant assets are excluded', () => {
  const inactive = [
    { ...fountain, attributes: { ...fountain.attributes, ID: 'RETIRED 4014' } },
    { ...fountain, attributes: { ...fountain.attributes, Inactive: true } },
    { ...fountain, attributes: { ...fountain.attributes, Retired: 1710000000000 } },
    { ...fountain, geometry: { x: -96.7, y: 32.8 } },
  ];
  assert.equal(normalizeArlingtonPins(inactive, 1, place, time).length, 0);
});
test('a pavilion polygon supplies an approximate point and shelter evidence, not measured tree shade', () => {
  const pavilion = {
    attributes: { OBJECTID: 25, ID: 'RLP Elm Grove', Parks: 'River Legacy', Name1: 'Elm Grove' },
    geometry: {
      rings: [
        [
          [-97.1161, 32.7901],
          [-97.1159, 32.7901],
          [-97.1159, 32.7903],
          [-97.1161, 32.7903],
          [-97.1161, 32.7901],
        ],
      ],
    },
  };
  const [p] = normalizeArlingtonPins([pavilion], 16, place, time);
  assert.equal(p?.name, 'River Legacy · Elm Grove');
  assert.equal(p?.feature, 'shelter');
  assert.equal(p?.approximateLocation, true);
  assert.ok(Math.abs(p!.longitude + 97.116) < 0.000001);
});
test('public trail overlay excludes emergency access and golf cart paths', () => {
  const f = {
    attributes: {
      OBJECTID: 1,
      ParkID: 'River Legacy',
      Name1: 'River Legacy Trail',
      Type1: 'Hike/Bike',
    },
    geometry: {
      paths: [
        [
          [-97.116, 32.79],
          [-97.115, 32.791],
        ],
      ],
    },
  };
  const trails = normalizeArlingtonTrails([
    f,
    { ...f, attributes: { ...f.attributes, Type1: 'Emergency Access' } },
    { ...f, attributes: { ...f.attributes, Type1: 'Cart Path' } },
  ]);
  assert.equal(trails.length, 1);
  assert.equal(trails[0]?.name, 'River Legacy Trail');
});
test('a park alone is not shade, a decorative fountain is not drinking water, and private places are excluded', () => {
  const e = { type: 'node', id: 1, lat: 32.79, lon: -97.116 };
  const pins = normalizeOsmPins(
    [
      { ...e, tags: { leisure: 'park', name: 'Unshaded Park' } },
      { ...e, tags: { amenity: 'fountain' } },
      { ...e, tags: { amenity: 'drinking_water', access: 'private' } },
    ],
    time,
  );
  assert.equal(pins.length, 0);
});
test('explicit OSM potable fountains and woodland evidence are distinguished', () => {
  const e = { type: 'way', id: 1, center: { lat: 32.79, lon: -97.116 } };
  const pins = normalizeOsmPins(
    [
      { ...e, tags: { amenity: 'fountain', drinking_water: 'yes' } },
      { ...e, id: 2, tags: { natural: 'wood', name: 'Trail woodland' } },
    ],
    time,
  );
  assert.equal(pins[0]?.kind, 'water');
  assert.equal(pins[1]?.feature, 'wooded-area');
  assert.match(pins[1]!.name, /potential shade/);
  assert.equal(pins[1]?.approximateLocation, true);
});
