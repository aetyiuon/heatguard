import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAiHandler } from '../backend/ai';
import { parseAiRequest, AI_MODEL } from '../src/domain/ai';
import { projectAiPersonal } from '../src/domain/aiPersonal';
import { WeatherBundle } from '../src/domain/types';

// Fictional fixtures only. Never replace these with someone's health entries.
const time = Date.parse('2026-10-25T17:00:00Z');
const personal = {
  profile: {
    age: 45,
    heightCm: 175,
    weightKg: 70,
    sex: 'female',
    conditions: ['diabetes'],
    medications: ['antihistamines'],
    fitness: 'acclimatized',
    hydration: 'adequate',
    shade: true,
    water: true,
  },
  checkIn: {
    at: time,
    feeling: 'well',
    hydration: 'adequate',
    clothing: 'ordinary',
    heartRate: { bpm: 75, at: time, context: 'rested' },
    temperature: { c: 36.7, at: time, method: 'oral' },
  },
  workload: 'light',
};
const base = { city: 'arlington', language: 'en', adult: true, consent: true };
const payload = { ...base, personalConsent: true, personal };
const env = { GROQ_API_KEY: 'synthetic-server-key' };
const request = (v: unknown) =>
  new Request('https://fixture.example/ai/outlook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(v),
  });
const weather = (): WeatherBundle => ({
  location: {
    latitude: 32.7357,
    longitude: -97.1081,
    name: 'Fixture city center',
    emergencyNumber: '911',
  },
  current: { time: new Date(time).toISOString(), temperatureC: 27, humidity: 40, windMs: 2 },
  fetchedAt: new Date(time).toISOString(),
  daily: [],
  hourly: [],
  alerts: [],
  sources: ['Public fixture'],
  warnings: [],
});
const answer = () =>
  Response.json({
    model: AI_MODEL,
    choices: [
      {
        finish_reason: 'stop',
        message: {
          content: JSON.stringify({
            summary:
              'Warm city conditions call for preparation. Review your activity and water access before leaving.',
            actions: ['bring-water', 'review-relief'],
          }),
        },
      },
    ],
  });

test('personal AI requires separate consent and exact typed inputs at every nested level', () => {
  assert.ok(parseAiRequest(payload, time));
  for (const v of [
    { ...payload, personalConsent: false },
    { ...base, personal },
    { ...payload, profile: personal.profile },
    { ...payload, personal: { ...personal, name: 'not allowed' } },
    {
      ...payload,
      personal: { ...personal, profile: { ...personal.profile, phone: 'not allowed' } },
    },
    { ...payload, personal: { ...personal, profile: { ...personal.profile, age: 17 } } },
    {
      ...payload,
      personal: {
        ...personal,
        profile: { ...personal.profile, conditions: ['unreviewed free text'] },
      },
    },
    {
      ...payload,
      personal: {
        ...personal,
        profile: { ...personal.profile, medications: ['unreviewed dosage'] },
      },
    },
    { ...payload, personal: { ...personal, profile: { ...personal.profile, weightKg: Infinity } } },
    {
      ...payload,
      personal: {
        ...personal,
        checkIn: {
          ...personal.checkIn,
          heartRate: { ...personal.checkIn.heartRate, deviceId: 'private' },
        },
      },
    },
    {
      ...payload,
      personal: {
        ...personal,
        checkIn: {
          ...personal.checkIn,
          temperature: { ...personal.checkIn.temperature, method: 'invented' },
        },
      },
    },
  ])
    assert.equal(parseAiRequest(v, time), null);
  assert.equal(parseAiRequest(payload, time + 31 * 60_000), null);
  assert.equal(parseAiRequest(payload, time - 1), null);
  assert.ok(parseAiRequest({ ...payload, personal: { ...personal, checkIn: null } }, time));
});
test('projection never spreads extra fields from app state or histories', () => {
  const v = parseAiRequest(payload, time)!.personal!;
  const projected = projectAiPersonal(
    { ...v.profile, ...{ phone: 'private', latitude: 32 } },
    { ...v.checkIn!, ...{ history: ['private'], deviceId: 'private' } },
    v.workload,
  );
  assert.equal(JSON.stringify(projected).includes('private'), false);
  assert.equal(projected.profile.sex, 'female');
  assert.equal(projected.checkIn!.temperature!.c, 36.7);
});
test('all reviewed personal factors reach Groq only in consented mode; responses never echo them', async () => {
  let sent: any;
  const handler = createAiHandler({
    now: () => time,
    weather: async () => weather(),
    fetch: async (_, init) => {
      sent = JSON.parse(JSON.parse(String(init!.body)).messages[1].content);
      return answer();
    },
  });
  const result = await handler(request(payload), env);
  assert.equal(result.status, 200);
  assert.deepEqual(sent.personal, personal);
  assert.equal(sent.latitude, undefined);
  const data = await result.json();
  assert.equal(data.scope, 'personal');
  assert.equal(data.personal, undefined);
  assert.equal(JSON.stringify(data).includes('antihistamines'), false);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
});
test('personal requests never reuse or populate shared city/language cache or pending work', async () => {
  let calls = 0;
  const handler = createAiHandler({
    now: () => time,
    weather: async () => weather(),
    fetch: async () => {
      calls++;
      return answer();
    },
  });
  await handler(request(base), env);
  await Promise.all([
    handler(request(payload), env),
    handler(
      request({
        ...payload,
        personal: { ...personal, profile: { ...personal.profile, weightKg: 72 } },
      }),
      env,
    ),
  ]);
  assert.equal(calls, 3);
  await handler(request(payload), env);
  assert.equal(calls, 4);
  const publicResult = await handler(request(base), env);
  assert.equal(calls, 4);
  assert.equal((await publicResult.json()).scope, 'city');
});
test('personal stop rules block cloud generation before private factors reach provider', async () => {
  let calls = 0;
  const handler = createAiHandler({
    now: () => time,
    weather: async () => weather(),
    fetch: async () => {
      calls++;
      return answer();
    },
  });
  for (const checkIn of [
    { ...personal.checkIn, feeling: 'emergency' },
    { ...personal.checkIn, temperature: { ...personal.checkIn.temperature, c: 38.2 } },
    { ...personal.checkIn, heartRate: { ...personal.checkIn.heartRate, bpm: 120 } },
    { ...personal.checkIn, hydration: 'low' },
  ]) {
    const r = await handler(request({ ...payload, personal: { ...personal, checkIn } }), env);
    assert.equal(r.status, 409);
    assert.equal((await r.json()).code, 'personal-stop');
  }
  assert.equal(calls, 0);
});

test('personal mode rejects generic weather and comfort assurances instead of calling them personalized', async () => {
  for (const summary of [
    'The city is cloudy and breezy. Humidity is low.',
    'Your light activity should feel comfortable in the breeze. Bring water.',
  ]) {
    const handler = createAiHandler({
      now: () => time,
      weather: async () => weather(),
      fetch: async () =>
        Response.json({
          model: AI_MODEL,
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({ summary, actions: ['bring-water', 'choose-shade'] }),
              },
            },
          ],
        }),
    });
    const result = await handler(request(payload), env);
    assert.equal(result.status, 502);
    assert.equal((await result.json()).code, 'invalid-response');
  }
});
