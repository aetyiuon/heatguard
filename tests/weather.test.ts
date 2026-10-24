import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createWeatherRefresher,
  currentWeatherSource,
  WEATHER_FOCUS_REFRESH_MS,
  WEATHER_REFRESH_MS,
  weatherAgeMinutes,
  weatherFreshness,
  WeatherLoadResult,
} from '../src/domain/weather';
import { evaluateRisk } from '../src/domain/risk';
import { sessionRemainingSeconds } from '../src/domain/session';
import { DEFAULT_PROFILE, OutdoorSession, Place, WeatherBundle } from '../src/domain/types';

const now = Date.parse('2026-10-23T18:00:00Z');
const place: Place = {
  name: 'Fixture',
  latitude: 32.79,
  longitude: -97.116,
  emergencyNumber: '911',
};
const bundle = (temperatureC = 26): WeatherBundle => ({
  fetchedAt: new Date(now).toISOString(),
  currentSource: 'modeled',
  location: place,
  current: {
    time: new Date(now).toISOString(),
    temperatureC,
    humidity: 50,
    windMs: 2,
    isDay: true,
    cloudCover: 50,
  },
  hourly: [],
  daily: [],
  alerts: [],
  sources: ['Open-Meteo (modeled current conditions)'],
  warnings: [],
});
function recorder() {
  const results: WeatherLoadResult[] = [];
  const errors: unknown[] = [];
  let starts = 0;
  let finishes = 0;
  return {
    results,
    errors,
    get starts() {
      return starts;
    },
    get finishes() {
      return finishes;
    },
    callbacks: {
      start: () => {
        starts++;
      },
      success: (r: WeatherLoadResult) => {
        results.push(r);
      },
      failure: (e: unknown) => {
        errors.push(e);
      },
      finish: () => {
        finishes++;
      },
    },
  };
}

test('temperature display and timer freshness reject stale, invalid, and future timestamps consistently', () => {
  const w = bundle();
  assert.equal(weatherFreshness(null, now), 'unavailable');
  assert.equal(weatherFreshness(w, now), 'current');
  assert.equal(weatherFreshness(w, now + 61 * 60_000), 'stale');
  assert.equal(weatherFreshness({ ...w, fetchedAt: 'invalid' }, now), 'invalid');
  assert.equal(
    weatherFreshness({ ...w, fetchedAt: new Date(now + 11 * 60_000).toISOString() }, now),
    'invalid',
  );
  assert.equal(
    weatherFreshness(
      { ...w, current: { ...w.current, time: new Date(now + 11 * 60_000).toISOString() } },
      now,
    ),
    'invalid',
  );
  assert.equal(weatherAgeMinutes(w, now + 7 * 60_000), 7);
  assert.equal(weatherAgeMinutes(null, now), null);
  assert.equal(weatherAgeMinutes({ ...w, current: { ...w.current, time: 'invalid' } }, now), null);
});

test('an API response time cannot make an old temperature reading look current', () => {
  const w = bundle();
  w.current.time = new Date(now - 2 * 3600_000).toISOString();
  assert.equal(weatherFreshness(w, now), 'stale');
  assert.equal(weatherAgeMinutes(w, now), 120);
  assert.equal(evaluateRisk(w, DEFAULT_PROFILE, 'moderate', now).window, null);
});

test('explicit current-data provenance wins over supplemental forecast sources and old bundles have a safe fallback', () => {
  const w = bundle();
  assert.equal(currentWeatherSource({ ...w, currentSource: 'forecast' }), 'forecast');
  assert.equal(currentWeatherSource({ ...w, currentSource: undefined }), 'modeled');
  assert.equal(
    currentWeatherSource({
      ...w,
      currentSource: undefined,
      sources: ['NWS hourly forecast (not an observation)'],
    }),
    'forecast',
  );
  assert.equal(currentWeatherSource({ ...w, currentSource: undefined, sources: [] }), 'unknown');
});

test('overlapping startup/manual checks share one weather request and one state update', async () => {
  let resolve!: (result: WeatherLoadResult) => void;
  let requests = 0;
  const sync = createWeatherRefresher(() => {
    requests++;
    return new Promise((r) => {
      resolve = r;
    });
  });
  const state = recorder();
  const first = sync.refresh(place, state.callbacks);
  const second = sync.refresh(place, state.callbacks);
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(requests, 1);
  resolve({ data: bundle(), cached: false });
  await first;
  assert.equal(state.starts, 1);
  assert.equal(state.results.length, 1);
  assert.equal(state.finishes, 1);
});

test('a slow old-location response cannot overwrite the new selected location', async () => {
  const deferred: ((result: WeatherLoadResult) => void)[] = [];
  const sync = createWeatherRefresher(
    () =>
      new Promise((resolve) => {
        deferred.push(resolve);
      }),
  );
  const state = recorder();
  const oldRequest = sync.refresh(place, state.callbacks);
  await Promise.resolve();
  sync.invalidate();
  const newPlace = { ...place, name: 'New place', longitude: -96.8 };
  const newRequest = sync.refresh(newPlace, state.callbacks);
  await Promise.resolve();
  deferred[1]!({ data: { ...bundle(35), location: newPlace }, cached: false });
  await newRequest;
  deferred[0]!({ data: bundle(26), cached: false });
  await oldRequest;
  assert.equal(state.results.length, 1);
  assert.equal(state.results[0]?.data.location.name, 'New place');
  assert.equal(state.finishes, 1);
});

test('automatic polling checks every five minutes and repeated focus events are throttled', async () => {
  let clock = now;
  let requests = 0;
  const sync = createWeatherRefresher(
    async () => {
      requests++;
      return { data: bundle(), cached: false };
    },
    () => clock,
  );
  const state = recorder();
  await sync.refresh(place, state.callbacks, WEATHER_REFRESH_MS);
  clock += WEATHER_REFRESH_MS - 1;
  await sync.refresh(place, state.callbacks, WEATHER_REFRESH_MS);
  assert.equal(requests, 1);
  clock++;
  await sync.refresh(place, state.callbacks, WEATHER_REFRESH_MS);
  assert.equal(requests, 2);
  await sync.refresh(place, state.callbacks, WEATHER_FOCUS_REFRESH_MS);
  assert.equal(requests, 2);
  clock += WEATHER_FOCUS_REFRESH_MS;
  await sync.refresh(place, state.callbacks, WEATHER_FOCUS_REFRESH_MS);
  assert.equal(requests, 3);
});

test('failed checks report failure without manufacturing weather and remain retryable', async () => {
  let clock = now;
  const sync = createWeatherRefresher(
    async () => {
      throw new Error('Offline');
    },
    () => clock,
  );
  const state = recorder();
  await sync.refresh(place, state.callbacks);
  await sync.refresh(place, state.callbacks, WEATHER_FOCUS_REFRESH_MS);
  assert.equal(state.errors.length, 1);
  assert.equal(state.results.length, 0);
  clock += WEATHER_REFRESH_MS;
  await sync.refresh(place, state.callbacks, WEATHER_REFRESH_MS);
  assert.equal(state.errors.length, 2);
  assert.equal(state.finishes, 2);
});

test('saved fallback remains marked as cached rather than a fresh successful weather fetch', async () => {
  const sync = createWeatherRefresher(async () => ({ data: bundle(), cached: true }));
  const state = recorder();
  await sync.refresh(place, state.callbacks);
  assert.equal(state.results[0]?.cached, true);
});

test('warmer readings tighten the existing break plan without resetting elapsed session time', () => {
  const profile = {
    ...DEFAULT_PROFILE,
    shade: true,
    water: true,
    hydration: 'adequate' as const,
    fitness: 'acclimatized' as const,
  };
  const cool = evaluateRisk(bundle(26), profile, 'moderate', now);
  const hot = evaluateRisk(bundle(35), profile, 'moderate', now);
  assert.ok(hot.tier > cool.tier);
  assert.ok(cool.window && hot.window && hot.window[0] < cool.window[0]);
  const session: OutdoorSession = {
    id: 'fixture',
    startedAt: now - 14 * 60_000,
    workStartedAt: now - 14 * 60_000,
    phase: 'active',
    breaks: 0,
    notificationIds: [],
  };
  assert.ok(
    sessionRemainingSeconds(session, hot, now) < sessionRemainingSeconds(session, cool, now),
  );
  assert.equal(session.workStartedAt, now - 14 * 60_000);
  assert.equal(evaluateRisk(bundle(40), profile, 'heavy', now).window, null);
});
