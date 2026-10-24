import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessPersonal, CHECK_IN_MS, validCheckIn, VITAL_MS } from '../src/domain/personal';
import { evaluateRisk } from '../src/domain/risk';
import { DEFAULT_PROFILE, PersonalCheckIn, Profile, WeatherBundle } from '../src/domain/types';
const now = Date.parse('2026-10-23T18:00:00Z');
const profile: Profile = {
  ...DEFAULT_PROFILE,
  age: 25,
  fitness: 'acclimatized',
  shade: true,
  water: true,
  hydration: 'adequate',
};
const check = (patch: Partial<PersonalCheckIn> = {}): PersonalCheckIn => ({
  at: now,
  feeling: 'well',
  hydration: 'adequate',
  clothing: 'ordinary',
  ...patch,
});
const weather: WeatherBundle = {
  fetchedAt: new Date(now).toISOString(),
  location: { latitude: 32.7, longitude: -97, name: 'Fixture', emergencyNumber: '911' },
  current: {
    time: new Date(now).toISOString(),
    temperatureC: 28,
    humidity: 30,
    windMs: 2,
    isDay: true,
  },
  hourly: [],
  daily: [],
  alerts: [],
  sources: [],
  warnings: [],
};
test('optional missing data keeps the general plan; normal vitals never add minutes', () => {
  const general = evaluateRisk(weather, profile, 'moderate', now);
  const personal = evaluateRisk(
    weather,
    profile,
    'moderate',
    now,
    check({
      heartRate: { bpm: 65, at: now, context: 'rested' },
      temperature: { c: 36.7, at: now, method: 'oral' },
    }),
  );
  assert.deepEqual(personal.window, general.window);
  assert.equal(personal.tier, general.tier);
  assert.equal(assessPersonal(null, profile, now).status, 'missing');
});
test('symptoms stop the countdown even in cool weather and with stale weather/vitals', () => {
  for (const feeling of ['unwell', 'emergency'] as const) {
    const c = check({ at: now - 2 * CHECK_IN_MS, feeling });
    const result = evaluateRisk(
      { ...weather, fetchedAt: 'invalid', current: { ...weather.current, temperatureC: 18 } },
      profile,
      'resting',
      now,
      c,
    );
    assert.equal(result.window, null);
    assert.match(result.stopReason!, feeling === 'emergency' ? /emergency services/ : /unwell/);
  }
});
test('adult rested pulse triggers pause; exercise pulse, unknown age and child pulse do not use adult cutoff', () => {
  const c = check({ heartRate: { bpm: 110, at: now, context: 'rested' } });
  assert.equal(assessPersonal(c, profile, now).stop, 'pulse');
  assert.equal(
    assessPersonal({ ...c, heartRate: { ...c.heartRate!, context: 'active' } }, profile, now).stop,
    undefined,
  );
  assert.equal(assessPersonal(c, { ...profile, age: undefined }, now).stop, undefined);
  assert.equal(assessPersonal(c, { ...profile, age: 12 }, now).stop, undefined);
  assert.equal(
    assessPersonal(check({ heartRate: { bpm: 100, at: now, context: 'rested' } }), profile, now)
      .stop,
    undefined,
  );
});
test('elevated thermometer is a pause for every supported thermometer site; wrist is context only', () => {
  for (const method of ['oral', 'ear', 'forehead'] as const) {
    assert.equal(
      assessPersonal(check({ temperature: { c: 38, at: now, method } }), profile, now).stop,
      'temperature',
    );
  }
  const wrist = assessPersonal(
    check({ temperature: { c: 38, at: now, method: 'wrist' } }),
    profile,
    now,
  );
  assert.equal(wrist.stop, undefined);
  assert.ok(wrist.messages.includes('wrist'));
});
test('old check-in pauses the countdown; old normal vitals do not masquerade as current monitoring', () => {
  const c = check({ heartRate: { bpm: 70, at: now, context: 'rested' } });
  assert.equal(assessPersonal(c, profile, now + CHECK_IN_MS).status, 'current');
  assert.equal(assessPersonal(c, profile, now + CHECK_IN_MS + 1).stop, 'update');
  assert.ok(assessPersonal(c, profile, now + VITAL_MS + 1).messages.includes('oldVitals'));
  assert.equal(evaluateRisk(weather, profile, 'light', now + CHECK_IN_MS + 1, c).window, null);
});
test('prior pulse/temperature caution does not disappear when measurement freshness expires', () => {
  for (const c of [
    check({ heartRate: { bpm: 110, at: now, context: 'rested' } }),
    check({ temperature: { c: 38.2, at: now, method: 'oral' } }),
  ]) {
    assert.ok(
      ['pulse', 'temperature'].includes(assessPersonal(c, profile, now + CHECK_IN_MS + 1).stop!),
    );
    assert.equal(evaluateRisk(weather, profile, 'light', now + CHECK_IN_MS + 1, c).window, null);
  }
});
test('low prior hydration and protective clothing suppress heat countdown; hydrated check-in overrides saved uncertainty', () => {
  for (const c of [check({ hydration: 'low' }), check({ clothing: 'heavy' })]) {
    assert.equal(evaluateRisk(weather, profile, 'light', now, c).window, null);
    assert.equal(assessPersonal(c, profile, now, false).stop, undefined);
  }
  assert.equal(
    assessPersonal(check(), { ...profile, hydration: 'unsure' }, now).hydration,
    'adequate',
  );
  assert.equal(assessPersonal(check(), profile, now + CHECK_IN_MS + 1).hydration, 'unsure');
});
test('invalid, future, impossible and already-old measurements never produce a usable personal countdown', () => {
  const invalid = [
    check({ at: now + 1 }),
    check({ heartRate: { bpm: NaN, at: now, context: 'rested' } }),
    check({ heartRate: { bpm: 0, at: now, context: 'rested' } }),
    check({ heartRate: { bpm: 80, at: now + 1, context: 'rested' } }),
    check({ temperature: { c: 98.6, at: now, method: 'oral' } }),
    check({ temperature: { c: 37, at: now - VITAL_MS - 1, method: 'oral' } }),
  ];
  for (const c of invalid) {
    assert.equal(validCheckIn(c, now), false);
    assert.equal(evaluateRisk(weather, profile, 'light', now, c).window, null);
  }
});
test('a new well check-in replaces an old caution but never proves physiological recovery', () => {
  const previous = check({ feeling: 'unwell' });
  assert.equal(evaluateRisk(weather, profile, 'light', now, previous).window, null);
  const updated = evaluateRisk(weather, profile, 'light', now, check());
  assert.ok(updated.window);
  assert.ok(updated.reasons.some((reason) => reason.includes('cannot establish safe exposure')));
});
test('adult BMI caution requires known adult age; children are not evaluated with adult BMI cutoffs', () => {
  for (const age of [undefined, 12]) {
    const result = evaluateRisk(
      weather,
      { ...profile, age, heightCm: 160, weightKg: 100 },
      'light',
      now,
    );
    assert.ok(!result.reasons.some((reason) => reason.includes('Higher BMI')));
  }
  assert.ok(
    evaluateRisk(weather, { ...profile, heightCm: 160, weightKg: 100 }, 'light', now).reasons.some(
      (reason) => reason.includes('Higher BMI'),
    ),
  );
});
