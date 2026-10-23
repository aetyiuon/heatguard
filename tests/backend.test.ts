import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest, parsePlace } from '../backend/app';
import { normalizeMeteo, parseHeatRisk } from '../backend/weather';
import { upstream } from '../backend/upstream';
test('coordinate validation rejects missing, nonnumeric and out-of-range data', () => {
  for (const q of ['', 'lat=&lon=0', 'lat=nope&lon=0', 'lat=91&lon=0', 'lat=0&lon=-181'])
    assert.throws(() => parsePlace(new URL('https://test/?' + q)));
});
test('coordinate cell normalization never requires health data', () => {
  assert.equal(parsePlace(new URL('https://test/?lat=30.123456&lon=-97.123456')).latitude, 30.123);
});
test('HeatRisk NoData is missing, never green', () => {
  for (const v of ['NoData', '', null, undefined, -1, 5, 2.5])
    assert.equal(parseHeatRisk(v), undefined);
  assert.equal(parseHeatRisk('0'), 0);
});
test('proxy rejects unsupported methods and origins', async () => {
  assert.equal(
    (await handleRequest(new Request('https://test/weather', { method: 'POST' }))).status,
    405,
  );
  assert.equal(
    (
      await handleRequest(
        new Request('https://test/health', { headers: { Origin: 'https://untrusted.test' } }),
      )
    ).status,
    403,
  );
});
test('missing community configuration is explicit', async () => {
  const r = await handleRequest(new Request('https://test/community?lat=0&lon=0'));
  assert.equal(r.status, 503);
  assert.match((await r.json()).error, /not configured/);
});
test('CORS preflight allows only the declared origin', async () => {
  const r = await handleRequest(
    new Request('https://test/health', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8081' },
    }),
  );
  assert.equal(r.status, 204);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
});
test('upstream cache coalesces concurrent requests', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return Response.json({ ok: true });
  };
  try {
    const [a, b] = await Promise.all([
      upstream('https://fixture.test/cache'),
      upstream('https://fixture.test/cache'),
    ]);
    assert.deepEqual(a, b);
    assert.equal(calls, 1);
    await upstream('https://fixture.test/cache');
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = original;
  }
});
test('normalization handles absolute time and local forecast dates', () => {
  const time = Date.parse('2026-10-02T18:00:00Z') / 1000;
  const p = parsePlace(new URL('https://test/?lat=30&lon=-97'));
  const m = {
    timezone: 'America/Chicago',
    current: {
      time,
      temperature_2m: 30,
      relative_humidity_2m: 40,
      wind_speed_10m: 2,
      cloud_cover: 10,
      is_day: 1,
    },
    hourly: {
      time: [time],
      temperature_2m: [30],
      relative_humidity_2m: [40],
      wind_speed_10m: [2],
      shortwave_radiation: [600],
      uv_index: [5],
    },
    daily: {
      time: [Date.parse('2026-10-02T05:00:00Z') / 1000],
      temperature_2m_max: [32],
      temperature_2m_min: [21],
      uv_index_max: [6],
    },
  };
  const b = normalizeMeteo(m, p);
  assert.equal(b.current.time, '2026-10-02T18:00:00.000Z');
  assert.equal(b.daily[0]?.date, '2026-10-02');
  assert.equal(b.current.uv, 5);
});
test('missing weather inputs never turn into zero-valued conditions', () => {
  assert.throws(() =>
    normalizeMeteo({ current: {} }, parsePlace(new URL('https://test/?lat=0&lon=0'))),
  );
});
