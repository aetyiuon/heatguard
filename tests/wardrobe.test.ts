import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendGear } from '../src/domain/wardrobe';
import { evaluateRisk } from '../src/domain/risk';
import { DEFAULT_PROFILE, WeatherBundle } from '../src/domain/types';
const b: WeatherBundle = {
  fetchedAt: new Date().toISOString(),
  location: { latitude: 0, longitude: 0, name: 'Fixture', emergencyNumber: '112' },
  current: { time: new Date().toISOString(), temperatureC: 32, humidity: 65, windMs: 2, uv: 7 },
  hourly: [],
  daily: [],
  alerts: [],
  sources: [],
  warnings: [],
};
test('UV, humidity and construction drive distinct gear explanations', () => {
  const gear = recommendGear(b, evaluateRisk(b, DEFAULT_PROFILE, 'heavy'), 'construction');
  for (const id of ['sun', 'wicking', 'ppe', 'water']) assert.ok(gear.some((g) => g.id === id));
});
test('electrolytes recommendation is conditional on prolonged sweating', () => {
  const gear = recommendGear(b, evaluateRisk(b, DEFAULT_PROFILE, 'light'), 'dog-walk');
  assert.match(gear.find((g) => g.id === 'electrolytes')!.why, /prolonged/);
});
