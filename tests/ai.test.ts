import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiHandler } from '../backend/ai';
import { hostedRequest } from '../backend/hosted';
import { parseAiRequest, parseAiText, parseAiResult } from '../src/domain/ai';
import { WeatherBundle } from '../src/domain/types';

const time = Date.parse('2026-10-25T17:00:00Z');
const text = {
  summary: 'The city is warm and humid. Cloud cover is limited.',
  actions: ['choose-shade', 'verify-access'],
};
const payload = { city: 'arlington', language: 'en', adult: true, consent: true };
const env = { GEMINI_API_KEY: 'server-only-fixture' };
function request(value: unknown = payload, suffix = '', method = 'POST') {
  return new Request(`https://heatguard.example/ai/outlook${suffix}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.5' },
    ...(method === 'POST' ? { body: JSON.stringify(value) } : {}),
  });
}
function weather(): WeatherBundle {
  return {
    location: {
      name: 'Public fixture',
      latitude: 32.7357,
      longitude: -97.1081,
      emergencyNumber: '911',
    },
    current: { time: new Date(time).toISOString(), temperatureC: 28, humidity: 65, windMs: 2 },
    fetchedAt: new Date(time).toISOString(),
    hourly: [],
    daily: [],
    alerts: [],
    sources: ['NWS fixture'],
    warnings: [],
  };
}
function response(value: unknown = text, finishReason = 'STOP') {
  return Response.json({
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }],
  });
}

test('AI contract rejects all private inputs, missing adult consent and arbitrary cities', () => {
  assert.ok(parseAiRequest(payload));
  for (const field of ['profile', 'heartRate', 'checkIn', 'route', 'latitude', 'name', 'prompt'])
    assert.equal(parseAiRequest({ ...payload, [field]: 'private' }), null);
  for (const v of [
    null,
    [],
    { ...payload, adult: false },
    { ...payload, consent: false },
    { ...payload, city: 'unknown' },
    { ...payload, language: 'fr' },
  ])
    assert.equal(parseAiRequest(v), null);
});
test('AI output cannot provide numeric durations, unsupported actions or medical assurances', () => {
  assert.ok(parseAiText(text));
  for (const summary of [
    'Stay outside for 45 minutes.',
    'You can safely stay outside.',
    'It is safe outside.',
    'Puedes quedarte una hora.',
    'Sin síntomas.',
    '<script>alert()</script>',
    '',
  ])
    assert.equal(parseAiText({ ...text, summary }), null);
  assert.equal(parseAiText({ ...text, actions: ['extend-timer', 'choose-shade'] }), null);
  assert.equal(parseAiText({ ...text, minutes: 20 }), null);
  assert.equal(parseAiText({ ...text, actions: ['choose-shade', 'choose-shade'] }), null);
});
test('AI endpoint rejects private/oversized/malformed input before any upstream call', async () => {
  let calls = 0;
  const handler = createAiHandler({
    fetch: async () => {
      calls++;
      return response();
    },
    weather: async () => {
      calls++;
      return weather();
    },
    now: () => time,
  });
  for (const data of [
    { ...payload, heartRate: 90 },
    { ...payload, adult: false },
    { ...payload, consent: false },
    null,
  ])
    assert.equal((await handler(request(data), env)).status, 400);
  assert.equal((await handler(request(payload, '?lat=32'), env)).status, 400);
  assert.equal((await handler(request({ secret: 'x'.repeat(300) }), env)).status, 413);
  assert.equal((await handler(request({}, '', 'GET'), env)).status, 405);
  assert.equal(
    (
      await handler(
        new Request('https://x/ai/outlook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{',
        }),
        env,
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});
test('missing key and unreviewed model fail honestly without upstream calls', async () => {
  const handler = createAiHandler({
    fetch: async () => {
      throw new Error('must not call');
    },
  });
  const r = await handler(request(), {});
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'not-configured');
  assert.equal((await handler(request(), { ...env, GEMINI_MODEL: 'paid-model' })).status, 503);
});
test('Gemini sees only public city weather; server key is a header, never a response or URL', async () => {
  let calls = 0;
  const handler = createAiHandler({
    now: () => time,
    weather: async (place) => {
      assert.equal(place.latitude, 32.7357);
      return weather();
    },
    fetch: async (url, init) => {
      calls++;
      assert.equal(
        String(url),
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      );
      assert.equal(new Headers(init?.headers).get('x-goog-api-key'), env.GEMINI_API_KEY);
      assert.ok(init?.signal);
      const body = JSON.parse(String(init?.body));
      const publicData = JSON.parse(body.contents[0].parts[0].text);
      assert.deepEqual(Object.keys(publicData).sort(), [
        'catalogCaveat',
        'city',
        'language',
        'weather',
      ]);
      assert.equal(publicData.city, 'Arlington');
      for (const key of [
        'latitude',
        'longitude',
        'profile',
        'heartRate',
        'risk',
        'route',
        'adult',
        'consent',
      ])
        assert.equal(key in publicData, false);
      assert.equal(String(init?.body).includes(env.GEMINI_API_KEY), false);
      assert.equal(body.tools, undefined);
      return response();
    },
  });
  const r = await handler(request(), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  const body = await r.json();
  assert.ok(parseAiResult(body, time));
  assert.equal(parseAiResult({ ...body, sources: undefined }, time), null);
  assert.equal(parseAiResult({ ...body, humidity: 150 }, time), null);
  assert.equal(
    parseAiResult({ ...body, expiresAt: new Date(time + 999_999).toISOString() }, time),
    null,
  );
  assert.equal(parseAiResult(body, time + 600_001), null);
  assert.equal(body.summary, text.summary);
  assert.equal(body.weatherTime, new Date(time).toISOString());
  assert.equal(body.expiresAt, new Date(time + 600_000).toISOString());
  assert.equal(JSON.stringify(body).includes(env.GEMINI_API_KEY), false);
  assert.equal(body.window, undefined);
  assert.equal((await handler(request(), env)).status, 200);
  assert.equal(calls, 1);
});
test('cached AI expires and concurrent public requests coalesce', async () => {
  let clock = time,
    calls = 0;
  const handler = createAiHandler({
    now: () => clock,
    weather: async () => ({
      ...weather(),
      fetchedAt: new Date(clock).toISOString(),
      current: { ...weather().current, time: new Date(clock).toISOString() },
    }),
    fetch: async () => {
      calls++;
      return response();
    },
  });
  const rs = await Promise.all([handler(request(), env), handler(request(), env)]);
  assert.ok(rs.every((r) => r.status === 200));
  assert.equal(calls, 1);
  clock += 601_000;
  assert.equal((await handler(request(), env)).status, 200);
  assert.equal(calls, 2);
});
test('stale or future city weather never reaches Google', async () => {
  for (const offset of [-61 * 60_000, 11 * 60_000]) {
    let calls = 0;
    const handler = createAiHandler({
      now: () => time,
      weather: async () => ({
        ...weather(),
        current: { ...weather().current, time: new Date(time + offset).toISOString() },
      }),
      fetch: async () => {
        calls++;
        return response();
      },
    });
    const r = await handler(request(), env);
    assert.equal(r.status, 503);
    assert.equal((await r.json()).code, 'weather-unavailable');
    assert.equal(calls, 0);
  }
});
test('quota, refusal, invalid JSON and provider errors are sanitized with no fake AI fallback', async () => {
  const cases: [() => Promise<Response>, number][] = [
    [async () => Response.json({ error: env.GEMINI_API_KEY }, { status: 429 }), 429],
    [async () => Response.json({ error: env.GEMINI_API_KEY }, { status: 401 }), 503],
    [async () => response(text, 'SAFETY'), 502],
    [async () => response({ ...text, summary: 'Stay for 45 minutes.' }), 502],
    [
      async () =>
        Response.json({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{' }] } }],
        }),
      502,
    ],
    [
      async () => {
        throw new Error(env.GEMINI_API_KEY);
      },
      503,
    ],
  ];
  for (const [fetcher, expected] of cases) {
    const handler = createAiHandler({
      now: () => time,
      weather: async () => weather(),
      fetch: fetcher,
    });
    const r = await handler(request(), env);
    assert.equal(r.status, expected);
    const body = await r.text();
    assert.equal(body.includes(env.GEMINI_API_KEY), false);
    assert.equal(body.includes('summary'), false);
  }
});
test('AI rate limits apply before weather or provider calls, even for cached results', async () => {
  let calls = 0;
  const handler = createAiHandler({
    now: () => time,
    weather: async () => weather(),
    fetch: async () => {
      calls++;
      return response();
    },
  });
  for (let i = 0; i < 5; i++) assert.equal((await handler(request(), env)).status, 200);
  assert.equal((await handler(request(), env)).status, 429);
  assert.equal(calls, 1);
});
test('hosted AI routing exposes availability without secrets and blocks non-US production AI', async () => {
  const r = await hostedRequest(
    new Request('https://heatguard.example/api/ai/outlook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    {},
  );
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'not-configured');
  const health = await hostedRequest(new Request('https://heatguard.example/api/health'), env);
  const body = await health.json();
  assert.equal(body.ai, true);
  assert.equal(JSON.stringify(body).includes(env.GEMINI_API_KEY), false);
  const denied = await hostedRequest(
    new Request('https://heatguard.example/api/ai/outlook', {
      method: 'POST',
      headers: { 'x-vercel-ip-country': 'GB' },
    }),
    { ...env, VERCEL: '1' },
  );
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, 'region');
});
