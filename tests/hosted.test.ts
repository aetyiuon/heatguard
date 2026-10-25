import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hostedRequest } from '../backend/hosted';

test('hosted community relay keeps credentials on the server and preserves consent payload', async () => {
  const original = globalThis.fetch;
  let target = '',
    payload = '',
    key = '';
  globalThis.fetch = async (input, init) => {
    target = String(input);
    payload = String(init?.body);
    key = new Headers(init?.headers).get('apikey') ?? '';
    return Response.json({ id: 'fixture' }, { status: 201 });
  };
  try {
    const r = await hostedRequest(
      new Request('https://heatguard.example/api/community/feel', {
        method: 'POST',
        headers: {
          Origin: 'https://heatguard.example',
          'X-Client-ID': 'fixture-installation-0001',
          'x-vercel-forwarded-for': '192.0.2.1',
        },
        body: JSON.stringify({ consent: true, latitude: 32.79, longitude: -97.11, feeling: 'hot' }),
      }),
      { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'public-fixture' },
    );
    assert.equal(r.status, 201);
    assert.equal(key, 'public-fixture');
    assert.equal(new URL(target).searchParams.get('path'), '/community/feel');
    assert.equal(JSON.parse(payload).consent, true);
    assert.equal((await r.text()).includes('public-fixture'), false);
  } finally {
    globalThis.fetch = original;
  }
});

test('hosted health route works with a same-origin browser request', async () => {
  const r = await hostedRequest(
    new Request('https://heatguard.example/api?route=health', {
      headers: { Origin: 'https://heatguard.example' },
    }),
    {},
  );
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://heatguard.example');
});
test('hosted adapter rejects another origin and unknown routes', async () => {
  assert.equal(
    (
      await hostedRequest(
        new Request('https://heatguard.example/api/health', {
          headers: { Origin: 'https://other.example' },
        }),
        {},
      )
    ).status,
    403,
  );
  assert.equal(
    (await hostedRequest(new Request('https://heatguard.example/api?route=../secret'), {})).status,
    404,
  );
});
test('hosted routing retains coordinate validation and method restrictions', async () => {
  assert.equal(
    (
      await hostedRequest(
        new Request('https://heatguard.example/api?route=weather&lat=91&lon=0'),
        {},
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await hostedRequest(
        new Request('https://heatguard.example/api/relief', { method: 'POST', body: '{}' }),
        {},
      )
    ).status,
    405,
  );
});

test('hosted city API reads traced JSON and preserves city district overlays', async () => {
  const response = await hostedRequest(
    new Request('https://heatguard.example/api/relief?city=arlington'),
    {},
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.city, 'arlington');
  assert.ok(data.pins.length > 100);
  assert.ok(data.regions.length > 0);
});
