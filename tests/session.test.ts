import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionController, sessionRemainingSeconds } from '../src/domain/session';
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
  lowHeat: false,
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function lifecycle(initial: OutdoorSession | null = null) {
  let current = initial,
    currentRisk: RiskEstimate | null = risk,
    clock = 1_000_000;
  const scheduled: ReturnType<typeof deferred<string[]>>[] = [];
  const canceled: string[][] = [];
  const controller = createSessionController({
    session: () => current,
    risk: () => currentRisk,
    clock: () => clock,
    commit: async (next) => {
      current = next;
    },
    warning: () => {},
    cancel: async (ids) => {
      canceled.push(ids);
    },
    schedule: async () => {
      const wait = deferred<string[]>();
      scheduled.push(wait);
      return wait.promise;
    },
  });
  return {
    controller,
    scheduled,
    canceled,
    get current() {
      return current;
    },
    setRisk: (next: RiskEstimate | null) => {
      currentRisk = next;
    },
    setClock: (next: number) => {
      clock = next;
    },
  };
}
test('ending a pending session start cancels late notification IDs without resurrecting the session', async () => {
  const h = lifecycle();
  const start = h.controller.start();
  await h.controller.end();
  h.scheduled[0]!.resolve(['late-start']);
  await start;
  assert.equal(h.current, null);
  assert.ok(h.canceled.some((ids) => ids.includes('late-start')));
});
test('rapid duplicate starts only commit the latest operation and cancel superseded reminders', async () => {
  const h = lifecycle();
  const first = h.controller.start(),
    second = h.controller.start();
  h.scheduled[1]!.resolve(['latest']);
  await second;
  h.scheduled[0]!.resolve(['superseded']);
  await first;
  assert.deepEqual(h.current?.notificationIds, ['latest']);
  assert.ok(h.canceled.some((ids) => ids.includes('superseded')));
});
test('a changed stop warning while permission is pending prevents starting a session', async () => {
  const h = lifecycle();
  const start = h.controller.start();
  h.setRisk({ ...risk, window: null, stopReason: 'Fixture stop' });
  h.scheduled[0]!.resolve(['unsafe-start']);
  await start;
  assert.equal(h.current, null);
  assert.ok(h.canceled.some((ids) => ids.includes('unsafe-start')));
});
test('ending during resume cannot revive a finished session', async () => {
  const h = lifecycle({ ...session, phase: 'break', breakStartedAt: 100_000 });
  const resume = h.controller.finishBreak();
  await h.controller.end();
  h.scheduled[0]!.resolve(['late-resume']);
  await resume;
  assert.equal(h.current, null);
  assert.ok(h.canceled.some((ids) => ids.includes('late-resume')));
});
test('a longer updated cooling requirement is rechecked after permission completes', async () => {
  const h = lifecycle({ ...session, phase: 'break', breakStartedAt: 100_000 });
  const resume = h.controller.finishBreak();
  h.setRisk({ ...risk, breakMinutes: 30 });
  h.scheduled[0]!.resolve(['too-soon']);
  await resume;
  assert.equal(h.current?.phase, 'break');
  assert.ok(h.canceled.some((ids) => ids.includes('too-soon')));
});
test('ending during notification reconciliation discards its late result', async () => {
  const h = lifecycle({ ...session, notificationIds: ['old'] });
  const reconcile = h.controller.reconcile();
  await new Promise((resolve) => setImmediate(resolve));
  await h.controller.end();
  h.scheduled[0]!.resolve(['late-reconcile']);
  await reconcile;
  assert.equal(h.current, null);
  assert.ok(h.canceled.some((ids) => ids.includes('late-reconcile')));
});
