import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  conditionFromCloudCover,
  conditionFromForecastText,
  conditionFromWmo,
  contrast,
  dayPeriod,
  localHour,
  mixColor,
  moonPhase,
  SKY_LAYERS,
  skyScene,
  skyWeather,
  sunAt,
} from '../src/domain/sky';
import { SkyCondition, WeatherBundle, WeatherPoint } from '../src/domain/types';

const DALLAS = { latitude: 32.78, longitude: -96.8 };
const at = (iso: string) => Date.parse(iso);
function bundle(
  now: number,
  current: Partial<WeatherPoint> = {},
  extra: Partial<WeatherBundle> = {},
) {
  return {
    fetchedAt: new Date(now).toISOString(),
    location: { ...DALLAS, name: 'Dallas', emergencyNumber: '911' },
    current: {
      time: new Date(now).toISOString(),
      temperatureC: 24,
      humidity: 40,
      windMs: 2,
      ...current,
    },
    hourly: [],
    daily: [],
    alerts: [],
    sources: [],
    warnings: [],
    ...extra,
  } satisfies WeatherBundle;
}

test('WMO codes map to sky conditions and unknown codes stay unreported', () => {
  const cases: [unknown, SkyCondition | undefined][] = [
    [0, 'clear'],
    [1, 'clear'],
    [2, 'partly-cloudy'],
    [3, 'cloudy'],
    [45, 'fog'],
    [53, 'drizzle'],
    [63, 'rain'],
    [81, 'rain'],
    [75, 'snow'],
    [86, 'snow'],
    [95, 'storm'],
    [99, 'storm'],
    [4, undefined],
    [-1, undefined],
    [2.5, undefined],
    [null, undefined],
    ['3', undefined],
  ];
  for (const [code, expected] of cases)
    assert.equal(conditionFromWmo(code), expected, String(code));
});

test('NWS wording draws precipitation only when it is likely or stated outright', () => {
  const cases: [string, SkyCondition | undefined][] = [
    ['Sunny', 'clear'],
    ['Mostly Clear', 'clear'],
    ['Partly Sunny', 'partly-cloudy'],
    ['Mostly Cloudy', 'cloudy'],
    ['Light Rain', 'rain'],
    ['Rain Showers Likely', 'rain'],
    ['Chance Rain Showers', 'cloudy'],
    ['Slight Chance Showers And Thunderstorms', 'partly-cloudy'],
    ['Showers And Thunderstorms Likely', 'storm'],
    ['Thunderstorms', 'storm'],
    ['Light Snow', 'snow'],
    ['Rain And Snow', 'snow'],
    ['Patchy Drizzle', 'drizzle'],
    ['Patchy Fog', 'fog'],
    ['Haze', undefined],
    ['', undefined],
  ];
  for (const [text, expected] of cases)
    assert.equal(conditionFromForecastText(text), expected, text);
  assert.equal(conditionFromForecastText(undefined), undefined);
});

test('cloud cover fallback rejects missing and impossible values', () => {
  assert.equal(conditionFromCloudCover(10), 'clear');
  assert.equal(conditionFromCloudCover(50), 'partly-cloudy');
  assert.equal(conditionFromCloudCover(95), 'cloudy');
  for (const v of [undefined, null, -5, 140, Number.NaN])
    assert.equal(conditionFromCloudCover(v), undefined);
});

test('the sun follows the place, rising and setting near published Dallas times', () => {
  // Dallas, 2026-06-21: sunrise about 6:20 CDT (11:20Z), sunset about 20:38 CDT (01:38Z).
  assert.equal(sunAt(at('2026-06-21T11:05:00Z'), DALLAS.latitude, DALLAS.longitude).day, undefined);
  const morning = sunAt(at('2026-06-21T11:35:00Z'), DALLAS.latitude, DALLAS.longitude);
  assert.ok(morning.day !== undefined && morning.day < 0.05 && morning.morning);
  const noon = sunAt(at('2026-06-21T18:29:00Z'), DALLAS.latitude, DALLAS.longitude);
  assert.ok(Math.abs(noon.elevation - (90 - 32.78 + 23.44)) < 0.5, String(noon.elevation));
  assert.ok(Math.abs(noon.day! - 0.5) < 0.02);
  const evening = sunAt(at('2026-06-22T01:25:00Z'), DALLAS.latitude, DALLAS.longitude);
  assert.ok(evening.day !== undefined && evening.day > 0.95 && !evening.morning);
  const dusk = sunAt(at('2026-06-22T01:50:00Z'), DALLAS.latitude, DALLAS.longitude);
  assert.ok(dusk.night !== undefined && dusk.night < 0.05);
  const midnight = sunAt(at('2026-06-21T06:30:00Z'), DALLAS.latitude, DALLAS.longitude);
  assert.ok(midnight.elevation < -30 && Math.abs(midnight.night! - 0.5) < 0.05);
});

test('solar noon includes the equation of time in both directions', () => {
  // Greenwich: solar noon about 11:44Z in early November and 12:14Z in mid-February.
  assert.equal(sunAt(at('2026-11-03T11:40:00Z'), 51.48, 0).morning, true);
  assert.equal(sunAt(at('2026-11-03T11:48:00Z'), 51.48, 0).morning, false);
  assert.equal(sunAt(at('2026-02-11T12:10:00Z'), 51.48, 0).morning, true);
  assert.equal(sunAt(at('2026-02-11T12:18:00Z'), 51.48, 0).morning, false);
});

test('polar night and midnight sun stay finite', () => {
  const winter = sunAt(at('2026-12-21T11:00:00Z'), 69.65, 18.96);
  assert.equal(winter.day, undefined);
  assert.ok(winter.elevation < 0 && Number.isFinite(winter.night!));
  const summer = sunAt(at('2026-06-21T23:00:00Z'), 69.65, 18.96);
  assert.ok(summer.elevation > 0 && Number.isFinite(summer.day!));
});

test('moon phase lands near observed new and full moons', () => {
  const nearNew = moonPhase(at('2024-04-08T18:21:00Z'));
  assert.ok(nearNew < 0.035 || nearNew > 0.965, String(nearNew));
  assert.ok(Math.abs(moonPhase(at('2024-04-23T23:49:00Z')) - 0.5) < 0.035);
});

test('the sky uses fresh readings only and never paints weather from stale data', () => {
  const now = at('2026-07-01T20:00:00Z');
  const fresh = bundle(now, { condition: 'rain' });
  assert.equal(skyWeather(fresh, now)?.condition, 'rain');
  const hour: WeatherPoint = {
    time: '2026-07-01T20:00:00.000Z',
    temperatureC: 30,
    humidity: 50,
    windMs: 2,
    condition: 'storm',
  };
  const olderCurrent = bundle(
    now,
    { time: '2026-07-01T17:30:00.000Z', condition: 'clear' },
    { fetchedAt: '2026-07-01T17:30:00.000Z', hourly: [hour] },
  );
  assert.equal(skyWeather(olderCurrent, now)?.condition, 'storm');
  assert.equal(skyWeather({ ...olderCurrent, hourly: [] }, now), undefined);
  const stale = { ...olderCurrent, fetchedAt: '2026-06-30T06:00:00.000Z' };
  assert.equal(skyWeather(stale, now), undefined);
  assert.equal(skyScene(DALLAS, stale, now).condition, undefined);
  assert.equal(skyWeather(null, now), undefined);
  const future = bundle(now + 3 * 3_600_000);
  assert.equal(skyWeather(future, now), undefined);
});

test('scenes combine time of day with the reported weather', () => {
  const day = at('2026-07-01T19:00:00Z');
  const night = at('2026-07-01T07:00:00Z');
  const unknown = skyScene(DALLAS, null, day);
  assert.ok(unknown.sun && !unknown.moon && unknown.daylight === 1);
  assert.equal(unknown.condition, undefined);
  assert.equal(unknown.rain + unknown.snow + unknown.clouds + unknown.heat, 0);
  const rain = skyScene(DALLAS, bundle(day, { condition: 'rain' }), day);
  assert.ok(rain.rain > 0 && rain.clouds > 0.5);
  const storm = skyScene(DALLAS, bundle(day, { condition: 'storm' }), day);
  assert.ok(storm.lightning && storm.rain >= rain.rain);
  const snow = skyScene(DALLAS, bundle(day, { condition: 'snow', temperatureC: -2 }), day);
  assert.ok(snow.snow > 0 && snow.rain === 0);
  const clearNight = skyScene(DALLAS, bundle(night, { condition: 'clear' }), night);
  assert.ok(!clearNight.sun && clearNight.moon && clearNight.stars > 0.5);
  assert.equal(clearNight.daylight, 0);
  const cloudyNight = skyScene(DALLAS, bundle(night, { condition: 'cloudy' }), night);
  assert.ok(cloudyNight.stars < clearNight.stars);
  const hot = skyScene(
    DALLAS,
    bundle(day, { condition: 'clear', temperatureC: 38, humidity: 45 }),
    day,
  );
  assert.equal(hot.heat, 2);
  const hotRain = skyScene(
    DALLAS,
    bundle(day, { condition: 'rain', temperatureC: 38, humidity: 45 }),
    day,
  );
  assert.equal(hotRain.heat, 0);
});

// The theme's dimmest text color, read from the source so the check follows palette changes.
const themeColor = (name: string) => {
  const hex = readFileSync('src/ui/theme.ts', 'utf8').match(
    new RegExp(`\\b${name}: '(#[0-9A-Fa-f]{6})'`),
  )?.[1];
  assert.ok(hex, `theme color ${name} not found`);
  return hex;
};
test('theme text keeps at least 4.5:1 on every broad sky layer', () => {
  const muted = themeColor('muted');
  const L = SKY_LAYERS;
  const conditions: (SkyCondition | undefined)[] = [
    undefined,
    'clear',
    'partly-cloudy',
    'cloudy',
    'fog',
    'drizzle',
    'rain',
    'snow',
    'storm',
  ];
  const places: [{ latitude: number; longitude: number }, string][] = [
    [DALLAS, '2026-06-21T05:00:00Z'],
    [{ latitude: 51.5, longitude: -0.13 }, '2026-12-21T00:00:00Z'],
    [{ latitude: -33.87, longitude: 151.2 }, '2026-01-10T00:00:00Z'],
  ];
  for (const [place, start] of places)
    for (const condition of conditions)
      for (const [temperatureC, humidity] of [
        [20, 40],
        [33, 50],
        [40, 45],
      ] as const)
        for (let minute = 0; minute < 24 * 60; minute += 6) {
          const now = at(start) + minute * 60_000;
          const s = skyScene(
            place,
            condition ? bundle(now, { condition, temperatureC, humidity }) : null,
            now,
          );
          const [top, middle, horizon] = s.colors;
          const sky = [
            top,
            middle,
            horizon,
            mixColor(top, middle, 0.5),
            mixColor(middle, horizon, 0.5),
          ];
          // Each area layer at its peak opacity over the sky it can cover. Thin strokes (rays,
          // rain, stars, snow) are excluded; they never fill the area behind a line of text.
          const areas = [...sky, s.cloud];
          for (const bg of sky) {
            if (s.sun) {
              const glow = s.heat ? L.sunGlow.heat : L.sunGlow.day;
              areas.push(mixColor(mixColor(bg, L.sun, glow), L.sun, L.sunCore));
            }
            if (s.moon) areas.push(mixColor(mixColor(bg, L.moon, L.moonGlow), L.moon, L.moonFill));
            if (s.fog) areas.push(mixColor(bg, L.fog.color, L.fog.alpha));
            if (s.lightning) areas.push(mixColor(bg, L.flash.color, L.flash.alpha));
          }
          if (s.glow) areas.push(mixColor(horizon, s.glow.color, s.glow.strength));
          if (s.heat && s.sun) areas.push(mixColor(horizon, L.haze.color, L.haze.alpha[s.heat]));
          for (const bg of areas)
            assert.ok(
              contrast(muted, bg) >= 4.5,
              `${condition} ${new Date(now).toISOString()} ${muted} on ${bg}`,
            );
        }
});

test('greetings follow the checked place’s clock when its zone is known', () => {
  const now = at('2026-07-01T12:00:00Z');
  assert.equal(localHour(now, 'Europe/London'), 13);
  assert.equal(localHour(now, 'America/Chicago'), 7);
  assert.equal(localHour(now, 'Not/AZone'), new Date(now).getHours());
  assert.deepEqual([4, 5, 11, 12, 16, 17, 20, 21].map(dayPeriod), [
    'night',
    'morning',
    'morning',
    'afternoon',
    'afternoon',
    'evening',
    'evening',
    'night',
  ]);
});
