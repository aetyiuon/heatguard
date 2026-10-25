import { test } from 'node:test';
import assert from 'node:assert/strict';
import { communityHandler } from '../supabase/functions/heatguard-community/handler';
const settings = {
  url: 'https://fixture.supabase.co',
  secret: 'server-only-fixture',
  publishable: ['public-fixture'],
};
const headers = {
  apikey: 'public-fixture',
  'X-Client-ID': 'test-installation-12345',
  'Content-Type': 'application/json',
};
function request(path: string, body?: unknown) {
  return new Request(
    `https://fixture.supabase.co/functions/v1/heatguard-community?path=${path}&lat=32.79&lon=-97.11`,
    {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  );
}
test('cloud community rejects missing keys and missing explicit sharing consent', async () => {
  let calls = 0;
  const handler = communityHandler(settings, async () => {
    calls++;
    return Response.json(true);
  });
  assert.equal((await handler(new Request('https://fixture.test'))).status, 401);
  assert.equal(calls, 0);
  assert.equal(
    (await handler(request('/community/feel', { latitude: 32, longitude: -97, feeling: 'hot' })))
      .status,
    400,
  );
  assert.equal(calls, 1);
});
test('cloud feeling writes retain coarse coordinates, hashed identity, and only permitted fields', async () => {
  let saved: any;
  const handler = communityHandler(settings, async (input, init) => {
    if (String(input).includes('/rpc/')) return Response.json(true);
    saved = JSON.parse(String(init?.body));
    // PostgREST returns 201 with an empty body for return=minimal inserts.
    return new Response(null, { status: 201 });
  });
  const response = await handler(
    request('/community/feel', {
      consent: true,
      latitude: 32.7902,
      longitude: -97.116,
      feeling: 'hot',
      heartRate: 123,
      phone: 'private',
    }),
  );
  assert.equal(response.status, 201);
  assert.equal(saved.latitude, 32.79);
  assert.equal(saved.longitude, -97.12);
  assert.match(saved.actor, /^[a-f0-9]{64}$/);
  assert.equal(saved.phone, undefined);
  assert.equal(saved.heartRate, undefined);
  assert.equal(JSON.stringify(saved).includes('test-installation'), false);
});
test('cloud reads omit actors and apply distinct votes to unverified pins', async () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const handler = communityHandler(settings, async (input, init) => {
    const url = String(input);
    if (url.includes('/rpc/')) return Response.json(true);
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });
    if (url.includes('heatguard_pins?'))
      return Response.json([
        {
          id,
          name: 'Fixture pavilion',
          latitude: 32.79,
          longitude: -97.11,
          kind: 'shade',
          created_at: Date.now(),
        },
      ]);
    if (url.includes('heatguard_votes?'))
      return Response.json(Array.from({ length: 3 }, () => ({ pin_id: id, kind: 'report' })));
    return Response.json([]);
  });
  const response = await handler(request('/community'));
  const result = await response.json();
  assert.equal(result.pins[0].reports, 3);
  assert.equal(result.pins[0].status, 'not-working');
  assert.equal(result.pins[0].official, false);
  assert.equal(result.pins[0].actor, undefined);
});
test('cloud rate limits and database failures fail explicitly without leaking credentials', async () => {
  const limited = communityHandler(settings, async () => Response.json(false));
  assert.equal((await limited(request('/community'))).status, 429);
  const failing = communityHandler(
    settings,
    async () => new Response('secret diagnostic', { status: 500 }),
  );
  const response = await failing(request('/community'));
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes('secret'), false);
});
