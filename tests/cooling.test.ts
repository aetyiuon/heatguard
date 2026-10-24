import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directionsUrl, findCoolingPlace } from '../src/domain/relief';
import { Place, ReliefPin } from '../src/domain/types';
import { DFW_PLACES } from '../src/domain/places';
import { bundledCity } from '../src/domain/cities';

const place: Place = { name: 'Selected place', latitude: 0, longitude: 0, emergencyNumber: '112' };
const candidate = (id: string, latitude = 0.01): ReliefPin => ({
  id,
  name: id,
  kind: 'ac',
  latitude,
  longitude: 0,
  status: 'unknown',
  source: 'Test fixture; access/AC unverified',
  updatedAt: '2026-10-23',
  official: false,
  confirmations: 0,
  reports: 0,
});
const empty = async (): Promise<ReliefPin[]> => [];

test('downloaded cooling candidates work without a network lookup even when cached map pins are only water', async () => {
  const result = await findCoolingPlace({
    place,
    cachedPins: [{ ...candidate('fountain'), kind: 'water' }],
    localPins: [],
    loadDownloadedPins: async () => [candidate('library')],
    loadNearbyPins: async () => {
      throw new Error('Network must not be needed');
    },
  });
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.pin.id, 'library');
    assert.equal(result.pin.status, 'unknown');
    assert.equal(result.pin.official, false);
  }
});

test('local unavailable reports override downloaded and newly fetched copies of the same place', async () => {
  const closed = { ...candidate('closed'), status: 'not-working' as const };
  const result = await findCoolingPlace({
    place,
    cachedPins: [],
    localPins: [closed],
    loadDownloadedPins: async () => [candidate('closed')],
    loadNearbyPins: async () => [candidate('closed'), candidate('alternative', 0.02)],
  });
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.pin.id, 'alternative');
});

test('live fallback is used when existing pins contain no usable cooling candidate', async () => {
  let fetched = false;
  const result = await findCoolingPlace({
    place,
    cachedPins: [{ ...candidate('flagged'), reports: 3 }],
    localPins: [],
    loadDownloadedPins: empty,
    loadNearbyPins: async () => {
      fetched = true;
      return [candidate('live')];
    },
  });
  assert.ok(fetched);
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.pin.id, 'live');
});

test('a failed live lookup and a successful empty lookup have explicit distinct outcomes', async () => {
  const options = { place, cachedPins: [], localPins: [], loadDownloadedPins: empty };
  assert.deepEqual(await findCoolingPlace({ ...options, loadNearbyPins: empty }), {
    status: 'not-found',
  });
  assert.deepEqual(
    await findCoolingPlace({
      ...options,
      loadNearbyPins: async () => {
        throw new Error('Offline');
      },
    }),
    { status: 'unavailable' },
  );
});

test('out-of-range and invalid cooling records do not become walking destinations', async () => {
  const result = await findCoolingPlace({
    place,
    cachedPins: [],
    localPins: [],
    loadDownloadedPins: async () => [candidate('distant', 1), candidate('invalid', NaN)],
    loadNearbyPins: empty,
  });
  assert.equal(result.status, 'not-found');
});

test('a failed bundled import does not hide an existing saved candidate', async () => {
  const result = await findCoolingPlace({
    place,
    cachedPins: [candidate('saved')],
    localPins: [],
    loadDownloadedPins: async () => {
      throw new Error('Download unavailable');
    },
    loadNearbyPins: async () => {
      throw new Error('Offline');
    },
  });
  assert.equal(result.status, 'found');
  if (result.status === 'found') assert.equal(result.pin.id, 'saved');
});

test('the River Legacy preset resolves to a real bundled library without live Overpass', async () => {
  const result = await findCoolingPlace({
    place: DFW_PLACES[0]!,
    cachedPins: [],
    localPins: [],
    loadDownloadedPins: async () => (await bundledCity('arlington')).pins,
    loadNearbyPins: async () => {
      throw new Error('Overpass unavailable');
    },
  });
  assert.equal(result.status, 'found');
  if (result.status === 'found') {
    assert.equal(result.pin.id, 'osm-node-9206314021');
    assert.match(result.pin.name, /Northeast Branch Library/);
    assert.ok(result.pin.distance > 2000 && result.pin.distance < 5000);
  }
});

test('directions keep the selected heat-check origin and destination coordinates distinct', () => {
  const destination = candidate('library');
  const url = new URL(directionsUrl(destination, place));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('origin'), '0,0');
  assert.equal(url.searchParams.get('destination'), '0.01,0');
  assert.equal(url.searchParams.get('travelmode'), 'walking');
  assert.equal(new URL(directionsUrl(destination)).searchParams.get('origin'), null);
});
