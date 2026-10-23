import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessionRemainingSeconds } from '../src/domain/session';
import { OutdoorSession, RiskEstimate } from '../src/domain/types';
const session: OutdoorSession = {
  id: 'fixture',
  startedAt: 100_000,
  workStartedAt: 100_000,
  phase: 'active',
  breaks: 0,
  notificationIds: [],
};
const risk: RiskEstimate = {
  heatIndexF: 85,
  adjustedTemperatureF: 90,
  tier: 0,
  window: [45, 60],
  breakMinutes: 10,
  reassessMinutes: 15,
  reasons: [],
  sourceSchedule: { workMinutes: 60, restMinutes: 0 },
  modelVersion: '0.1.0',
};
test('stale UI clock cannot extend the promised break reminder', () => {
  assert.equal(sessionRemainingSeconds(session, risk, 90_000), 45 * 60);
});
test('wall-clock elapsed time is honored after backgrounding', () => {
  assert.equal(sessionRemainingSeconds(session, risk, 100_000 + 44 * 60_000), 60);
  assert.equal(sessionRemainingSeconds(session, risk, 100_000 + 50 * 60_000), 0);
});
test('shorter updated window takes effect without resetting elapsed work', () => {
  assert.equal(
    sessionRemainingSeconds(session, { ...risk, window: [15, 30] }, 100_000 + 14 * 60_000),
    60,
  );
});
test('break timer uses the cooling duration rather than granting new work time', () => {
  assert.equal(
    sessionRemainingSeconds(
      { ...session, phase: 'break', breakStartedAt: 200_000 },
      risk,
      200_000 + 9 * 60_000,
    ),
    60,
  );
});
