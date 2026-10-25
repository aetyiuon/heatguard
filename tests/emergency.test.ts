import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emergencyNumberForCoordinates,
  emergencyNumberForCountry,
  resolveEmergencyNumber,
} from '../src/domain/emergency';
import { parsePlace } from '../backend/app';
test('reverse-geocoded country wins over coordinates', () => {
  assert.equal(emergencyNumberForCountry('gb'), '999');
  assert.equal(emergencyNumberForCountry('FR'), '112');
  assert.equal(emergencyNumberForCountry(undefined), '112');
  // A geocoded country overrides the coordinate boxes.
  assert.equal(resolveEmergencyNumber(32.7, -97.1, 'JP'), '119');
});
test('coordinates alone resolve known emergency regions', () => {
  assert.equal(emergencyNumberForCoordinates(32.79, -97.116), '911'); // Arlington, TX
  assert.equal(emergencyNumberForCoordinates(61.22, -149.9), '911'); // Anchorage
  assert.equal(emergencyNumberForCoordinates(21.31, -157.86), '911'); // Honolulu
  assert.equal(emergencyNumberForCoordinates(43.65, -79.38), '911'); // Toronto
  assert.equal(emergencyNumberForCoordinates(51.51, -0.13), '999'); // London
  assert.equal(emergencyNumberForCoordinates(-33.87, 151.21), '000'); // Sydney
  assert.equal(emergencyNumberForCoordinates(-36.85, 174.76), '111'); // Auckland
});
test('unknown places fall back to 112, never 911', () => {
  assert.equal(emergencyNumberForCoordinates(48.85, 2.35), undefined); // Paris
  assert.equal(resolveEmergencyNumber(48.85, 2.35), '112');
  assert.equal(resolveEmergencyNumber(66.94, -53.67), '112'); // Sisimiut, Greenland
  assert.equal(resolveEmergencyNumber(-23.55, -46.63), '112'); // São Paulo (no box)
});
test('the weather proxy reports the emergency number for the requested coordinates', () => {
  assert.equal(parsePlace(new URL('https://test/?lat=32.79&lon=-97.12')).emergencyNumber, '911');
  assert.equal(parsePlace(new URL('https://test/?lat=48.85&lon=2.35')).emergencyNumber, '112');
});
