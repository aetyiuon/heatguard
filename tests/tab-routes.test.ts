import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashForTab, tabFromHash, titleForTab } from '../src/state/tabRoutes';
import type { Tab } from '../src/state/useHeatGuard';
const TABS: Tab[] = ['home', 'relief', 'journey', 'plan', 'community', 'profile'];
test('every tab round-trips through its URL fragment', () => {
  for (const tab of TABS) assert.equal(tabFromHash(hashForTab(tab)), tab);
  assert.equal(new Set(TABS.map(hashForTab)).size, TABS.length);
});
test('fragments use the visible tab names', () => {
  assert.equal(hashForTab('relief'), '#/relief-map');
  assert.equal(hashForTab('plan'), '#/forecast');
  assert.equal(hashForTab('profile'), '#/my-plan');
});
test('loose or unknown fragments are tolerated', () => {
  assert.equal(tabFromHash('#relief-map'), 'relief');
  assert.equal(tabFromHash('#/Forecast'), 'plan');
  assert.equal(tabFromHash('#/journey?from=share'), 'journey');
  assert.equal(tabFromHash(''), undefined);
  assert.equal(tabFromHash('#/nope'), undefined);
});
test('page titles name the open tab', () => {
  assert.equal(titleForTab('home'), 'HeatGuard');
  assert.equal(titleForTab('relief'), 'Relief Map · HeatGuard');
});
