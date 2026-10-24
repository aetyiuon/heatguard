import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTrack,
  assessJourney,
  JourneyRoute,
  routeDistance,
  sampleRoute,
  TrackPoint,
  mappedTrailSection,
} from '../src/domain/journey';
import { biometricFresh, biometricSample } from '../src/domain/biometrics';
import { DEFAULT_PROFILE, ReliefPin, WeatherBundle } from '../src/domain/types';
import { evaluateRisk } from '../src/domain/risk';
const now = Date.parse('2026-10-24T14:00:00Z');
const a = { latitude: 32.79, longitude: -97.116 },
  b = { latitude: 32.8, longitude: -97.116 };
const route: JourneyRoute = { name: 'Synthetic test route', kind: 'sketch', paths: [[a, b]] };
const weather: WeatherBundle = {
  fetchedAt: new Date(now).toISOString(),
  location: { ...a, name: 'Test', emergencyNumber: '911' },
  current: {
    time: new Date(now).toISOString(),
    temperatureC: 20,
    humidity: 40,
    windMs: 2,
    isDay: false,
  },
  hourly: [],
  daily: [],
  alerts: [],
  sources: [],
  warnings: [],
};
const risk = evaluateRisk(weather, { ...DEFAULT_PROFILE, water: true }, 'light', now);
test('mapped trail selection follows connected edges without teleporting across disconnected fragments', () => {
  const path = mappedTrailSection([
    [
      [-97, 32],
      [-97, 32.001],
    ],
    [
      [-97, 32.002],
      [-97, 32.001],
    ],
    [
      [-98, 33],
      [-98, 33.0001],
    ],
  ]);
  assert.ok(routeDistance([path]) > 200 && routeDistance([path]) < 250);
  assert.ok(path.every((p) => p.longitude === -97));
  const loop = mappedTrailSection([
    [
      [-97, 32],
      [-97, 32.001],
      [-97.001, 32],
      [-97, 32],
    ],
  ]);
  assert.ok(loop.length >= 4);
});
const pin = (overrides: Partial<ReliefPin> = {}): ReliefPin => ({
  id: 'cool',
  name: 'Mapped test shelter',
  ...a,
  kind: 'shade',
  feature: 'shelter',
  source: 'Synthetic test',
  official: false,
  status: 'unknown',
  updatedAt: new Date(now).toISOString(),
  confirmations: 0,
  reports: 0,
  ...overrides,
});
test('route length and samples preserve endpoints without joining disconnected paths', () => {
  const disconnected = [
    [a, b],
    [
      { latitude: 33, longitude: -98 },
      { latitude: 33.001, longitude: -98 },
    ],
  ];
  assert.ok(routeDistance(disconnected) < 1300);
  const samples = sampleRoute(disconnected);
  assert.equal(samples[0]!.latitude, a.latitude);
  assert.equal(samples.at(-1)!.latitude, 33.001);
  assert.ok(samples.every((p) => p.meters <= routeDistance(disconnected) + 0.001));
  const dense = [
    Array.from({ length: 2000 }, (_, i) => ({
      latitude: a.latitude + i * 0.000001,
      longitude: a.longitude,
    })),
  ];
  assert.ok(sampleRoute(dense).length < 10, 'dense vertices do not multiply coverage work');
  assert.throws(() => sampleRoute([[{ latitude: NaN, longitude: 0 }]]));
});
test('journey review never credits water, woods, broken or flagged places as cooling shelter', () => {
  const excluded = [
    pin({ id: 'water', kind: 'water' }),
    pin({ id: 'woods', feature: 'wooded-area' }),
    pin({ id: 'broken', status: 'not-working' }),
    pin({ id: 'flagged', reports: 3 }),
  ];
  const report = assessJourney(route, excluded, 12, risk);
  assert.equal(report.stops.length, 0);
  assert.equal(report.worstReliefMeters, null);
  assert.equal(report.uncoveredSamples, report.sampleCount);
  assert.equal(report.status, 'relief-gaps');
  assert.equal(assessJourney(route, [pin()], 12, null).status, 'unavailable');
  assert.equal(assessJourney(route, [pin()], 12, { ...risk, window: null }).breakEvery, null);
  assert.throws(() => assessJourney(route, [], 0, risk));
});
test('longer journeys schedule cooling time without claiming a verified stop or safe duration', () => {
  const report = assessJourney(route, [pin()], 30, { ...risk, window: [10, 15], breakMinutes: 10 });
  assert.ok(report.stops.length > 0);
  assert.ok(report.uncoveredSamples > 0);
  assert.equal(report.breakCount, Math.ceil(report.movingMinutes / 10) - 1);
  assert.equal(report.totalMinutes, report.movingMinutes + report.breakCount! * 10);
  const stale = evaluateRisk(weather, DEFAULT_PROFILE, 'light', now + 2 * 3600000);
  assert.equal(assessJourney(route, [pin()], 12, stale).status, 'postpone');
});
test('cooling access can exceed the break interval even within the 500-meter proximity flag', () => {
  const short = {
    ...route,
    paths: [[a, { latitude: a.latitude + 0.0001, longitude: a.longitude }]],
  };
  const report = assessJourney(short, [pin({ latitude: a.latitude + 0.0036 })], 12, {
    ...risk,
    window: [5, 10],
  });
  assert.equal(report.uncoveredSamples, 0);
  assert.ok(report.reliefWalkMinutes! >= 5);
  assert.equal(report.reliefBeyondBreak, true);
  assert.equal(report.status, 'relief-gaps');
});
test('GPS recording rejects bad time, accuracy and jumps, and keeps pause/outage gaps separate', () => {
  const first: TrackPoint = { ...a, at: now - 10000, accuracy: 10 };
  const initial = appendTrack([], first, now).paths;
  assert.equal(appendTrack(initial, { ...b, at: now, accuracy: 100 }, now).accepted, false);
  assert.equal(appendTrack(initial, { ...a, at: now - 20000, accuracy: 5 }, now).reason, 'time');
  assert.equal(appendTrack(initial, { ...b, at: now, accuracy: 5 }, now).reason, 'jump');
  assert.equal(appendTrack(initial, { ...a, at: now, accuracy: 5 }, now).reason, 'stationary');
  const afterGap = appendTrack(initial, { ...b, at: now + 70000, accuracy: 5 }, now + 70000);
  assert.equal(afterGap.paths.length, 2);
  assert.equal(routeDistance(afterGap.paths), 0);
  const resumed = appendTrack([...initial, []], { ...b, at: now, accuracy: 5 }, now);
  assert.equal(resumed.paths.length, 2);
  assert.equal(appendTrack(initial, { ...b, at: now + 60000, accuracy: 5 }, now).accepted, false);
});
test('biometric source and original acquisition time control freshness; no fabricated readings', () => {
  assert.equal(
    biometricSample({ bpm: 70, at: now + 60000, source: 'apple-watch-live' }, now),
    null,
  );
  assert.equal(biometricSample({ bpm: 70, at: now, source: 'demo' }, now), null);
  assert.equal(biometricSample({ bpm: 0, at: now, source: 'apple-health' }, now), null);
  assert.equal(
    biometricFresh({ bpm: 72, at: now - 31000, source: 'apple-watch-live' }, now),
    false,
  );
  assert.equal(biometricFresh({ bpm: 72, at: now - 31000, source: 'apple-health' }, now), true);
  assert.equal(biometricFresh({ bpm: 72, at: now - 301000, source: 'apple-health' }, now), false);
});
