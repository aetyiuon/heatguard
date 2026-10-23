import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adjustedTemperatureF,
  approximateWbgtC,
  evaluateRisk,
  heatIndexF,
  heatIndexTier,
  nioshCycle,
} from '../src/domain/risk';
import { DEFAULT_PROFILE, Profile, WeatherBundle, WeatherPoint } from '../src/domain/types';
const now = Date.parse('2026-10-02T18:00:00Z');
const point: WeatherPoint = {
  time: new Date(now).toISOString(),
  temperatureC: 32.2222222222,
  humidity: 30,
  windMs: 2,
  solarWm2: 700,
  cloudCover: 0,
  isDay: true,
};
const profile: Profile = {
  ...DEFAULT_PROFILE,
  fitness: 'acclimatized',
  shade: true,
  water: true,
  hydration: 'adequate',
};
const bundle = (
  patch: Partial<WeatherPoint> = {},
  extra: Partial<WeatherBundle> = {},
): WeatherBundle => ({
  fetchedAt: new Date(now).toISOString(),
  location: { latitude: 30, longitude: -97, name: 'Test fixture', emergencyNumber: '911' },
  current: { ...point, ...patch },
  hourly: [],
  daily: [],
  alerts: [],
  sources: [],
  warnings: [],
  ...extra,
});
test('NWS reference: 90°F and 70% RH gives approximately 106°F', () => {
  assert.ok(Math.abs(heatIndexF(90, 70) - 105.922) < 0.01);
});
test('NWS reference: 100°F and 40% RH gives approximately 109°F', () => {
  assert.ok(Math.abs(heatIndexF(100, 40) - 109.256) < 0.02);
});
test('Steadman branch preserves a non-extreme estimate below regression conditions', () => {
  assert.ok(heatIndexF(70, 50) < 80);
});
test('low/high humidity adjustments stay finite', () => {
  assert.ok(Number.isFinite(heatIndexF(100, 10)));
  assert.ok(Number.isFinite(heatIndexF(85, 90)));
});
test('invalid temperature and humidity fail rather than produce a plausible timer', () => {
  for (const args of [
    [NaN, 50],
    [90, 101],
    [90, -1],
    [Infinity, 30],
  ])
    assert.throws(() => heatIndexF(args[0]!, args[1]!), RangeError);
});
test('OSHA historical tier boundaries are explicit', () => {
  assert.deepEqual([90.99, 91, 103, 103.01, 115, 115.01].map(heatIndexTier), [0, 1, 1, 2, 2, 3]);
});
test('NIOSH example: 90°F, partial cloud, 50% RH becomes 103°F', () => {
  assert.ok(
    Math.abs(adjustedTemperatureF({ ...point, humidity: 50, cloudCover: 50 }, false) - 103) < 0.01,
  );
  assert.deepEqual(nioshCycle(103, 'moderate'), { workMinutes: 30, restMinutes: 30 });
});
test('NIOSH example: heavy work at adjusted 104°F is 20/40', () => {
  assert.deepEqual(nioshCycle(104, 'heavy'), { workMinutes: 20, restMinutes: 40 });
});
test('NIOSH Caution cells never become invented minutes', () => {
  assert.equal(nioshCycle(106, 'heavy').workMinutes, null);
  assert.equal(nioshCycle(108, 'moderate').workMinutes, null);
  assert.equal(nioshCycle(111, 'light').workMinutes, null);
});
test('NIOSH humidity bins conservatively round up', () => {
  assert.ok(Math.abs(adjustedTemperatureF({ ...point, humidity: 41 }, true) - 96) < 0.01);
});
test('night removes solar schedule adjustment', () => {
  assert.equal(
    adjustedTemperatureF({ ...point, isDay: false }, false),
    adjustedTemperatureF(point, true),
  );
});
test('fractional temperatures round toward more rest', () => {
  assert.equal(nioshCycle(100.2, 'moderate').workMinutes, 40);
});
test('normal cycle is a bounded app planning range, not unlimited safe exposure', () => {
  const r = evaluateRisk(bundle({ temperatureC: 24, humidity: 30 }), profile, 'moderate', now);
  assert.deepEqual(r.window, [45, 60]);
  assert.equal(r.breakMinutes, 10);
});
test('profile concern cannot improve a recommendation', () => {
  const b = bundle({ temperatureC: 30, humidity: 50 });
  const a = evaluateRisk(b, profile, 'moderate', now);
  const r = evaluateRisk(b, { ...profile, age: 70, conditions: ['kidney'] }, 'moderate', now);
  assert.ok(r.tier >= a.tier);
  assert.ok(!r.window || r.window[0] <= a.window![0]);
});
test('sex does not invent individual heat tolerance', () => {
  const b = bundle();
  assert.deepEqual(
    evaluateRisk(b, { ...profile, sex: 'male' }, 'moderate', now),
    evaluateRisk(b, { ...profile, sex: 'female' }, 'moderate', now),
  );
});
test('personal cautions do not label cool weather as a heat hazard', () => {
  const r = evaluateRisk(
    bundle({ temperatureC: 15, humidity: 50 }),
    { ...profile, age: 75, conditions: ['diabetes'], fitness: 'sedentary' },
    'light',
    now,
  );
  assert.equal(r.tier, 0);
});
test('HeatRisk 4 suppresses a numeric activity window without modifying the official level', () => {
  const b = bundle({ temperatureC: 25 }, { heatRisk: 4 });
  assert.equal(evaluateRisk(b, profile, 'light', now).window, null);
  assert.equal(b.heatRisk, 4);
});
test('stale weather blocks a new timer', () => {
  const r = evaluateRisk(
    bundle({ time: new Date(now - 61 * 60000).toISOString() }),
    profile,
    'light',
    now,
  );
  assert.equal(r.window, null);
  assert.match(r.stopReason!, /stale/i);
});
test('a future weather timestamp is rejected', () => {
  assert.equal(
    evaluateRisk(bundle({ time: new Date(now + 11 * 60000).toISOString() }), profile, 'light', now)
      .window,
    null,
  );
});
test('no water in hot conditions blocks a timer', () => {
  assert.equal(evaluateRisk(bundle(), { ...profile, water: false }, 'moderate', now).window, null);
});
test('occupational schedule is not applied to children in heat', () => {
  assert.equal(evaluateRisk(bundle(), { ...profile, age: 12 }, 'moderate', now).window, null);
});
test('missing HeatRisk never synthesizes an official score', () => {
  const b = bundle();
  evaluateRisk(b, profile, 'moderate', now);
  assert.equal(b.heatRisk, undefined);
});
test('WBGT screening requires solar input and valid Stull range', () => {
  assert.equal(approximateWbgtC({ ...point, solarWm2: undefined }), undefined);
  assert.equal(approximateWbgtC({ ...point, humidity: 0 }), undefined);
});
test('WBGT screening responds to measured radiation/wind inputs', () => {
  const a = approximateWbgtC({ ...point, solarWm2: 0 })!,
    b = approximateWbgtC(point)!,
    c = approximateWbgtC({ ...point, windMs: 8 })!;
  assert.ok(b > a);
  assert.ok(c < b);
});
