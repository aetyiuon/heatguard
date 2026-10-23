import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickedCoordinates, suggestionCoordinates } from '../src/domain/relief';
test('map picks require real numeric coordinates and blank suggestion fields never become zero coordinates', () => {
  for (const value of [
    null,
    {},
    '32,-97',
    { latitude: '32', longitude: -97 },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: NaN, longitude: 0 },
    { latitude: 0, longitude: Infinity },
  ])
    assert.equal(pickedCoordinates(value), null);
  assert.deepEqual(
    pickedCoordinates({ latitude: 31.7621, longitude: -95.6308, extra: 'ignored' }),
    { latitude: 31.7621, longitude: -95.6308 },
  );
  assert.equal(suggestionCoordinates('', ''), null);
  assert.equal(suggestionCoordinates('  ', '-97'), null);
  assert.equal(suggestionCoordinates('31', ''), null);
  assert.deepEqual(suggestionCoordinates('31.7621', '-95.6308'), {
    latitude: 31.7621,
    longitude: -95.6308,
  });
});
import { distanceMeters, mergePins, nearestAc, rankedRelief } from '../src/domain/relief';
import { Place, ReliefPin } from '../src/domain/types';
const place: Place = { name: 'Fixture', latitude: 0, longitude: 0, emergencyNumber: '112' };
const pin = (id: string, lat: number, status: ReliefPin['status'] = 'unknown'): ReliefPin => ({
  id,
  name: id,
  latitude: lat,
  longitude: 0,
  kind: 'ac',
  source: 'Fixture',
  official: false,
  status,
  updatedAt: '2026-10-02',
  confirmations: 0,
  reports: 0,
});
test('one degree of latitude is approximately 111km', () => {
  assert.ok(Math.abs(distanceMeters(place, { latitude: 1, longitude: 0 }) - 111195) < 2);
});
test('nearest AC excludes unavailable and moderated-down pins', () => {
  const a = pin('closed', 0.001, 'not-working'),
    b = { ...pin('flagged', 0.002), reports: 3 },
    c = pin('available', 0.003);
  assert.equal(nearestAc([a, b, c], place)?.id, 'available');
});
test('no pins returns no imaginary AC location', () => {
  assert.equal(nearestAc([], place), undefined);
});
test('walk estimates state a conservative rounding of straight-line distance', () => {
  assert.equal(rankedRelief([pin('a', 0.001)], place)[0]?.walkMinutes, 2);
});
test('local broken-fountain report replaces original without duplicate pins', () => {
  const remote = pin('same', 0.001),
    local = { ...remote, status: 'not-working' as const };
  const merged = mergePins([remote], [local]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.status, 'not-working');
  assert.equal(nearestAc(merged, place), undefined);
});
