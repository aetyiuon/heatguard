import { test } from 'node:test';
import assert from 'node:assert/strict';
import { profileNumberDraft, parseProfileNumbers } from '../src/domain/profileForm';
import { reliefWalkNeedsWarning } from '../src/domain/relief';

test('profile decimals survive saving, including decimal-comma entry', () => {
  assert.deepEqual(parseProfileNumbers({ age: '25', heightCm: '175.5', weightKg: '70.5' }), {
    age: 25,
    heightCm: 175.5,
    weightKg: 70.5,
  });
  assert.equal(parseProfileNumbers({ age: '', heightCm: '', weightKg: '70,5' })?.weightKg, 70.5);
  assert.equal(parseProfileNumbers({ age: '', heightCm: '', weightKg: '70.' })?.weightKg, 70);
});

test('clearing optional profile fields removes old numbers without converting blanks to zero', () => {
  assert.deepEqual(profileNumberDraft({ weightKg: 70.5 }), {
    age: '',
    heightCm: '',
    weightKg: '70.5',
  });
  assert.deepEqual(parseProfileNumbers({ age: ' ', heightCm: '', weightKg: '' }), {
    age: undefined,
    heightCm: undefined,
    weightKg: undefined,
  });
});

test('profile save still rejects invalid and out-of-range numbers', () => {
  for (const fields of [
    { age: '17', heightCm: '', weightKg: '' },
    { age: '', heightCm: '251', weightKg: '' },
    { age: '', heightCm: '', weightKg: '705' },
    { age: '', heightCm: '', weightKg: 'NaN' },
    { age: '', heightCm: '', weightKg: '70,5.5' },
  ])
    assert.equal(parseProfileNumbers(fields), null);
});

test('cool-weather routine reassessment is not presented as a heat-limited walk window', () => {
  assert.equal(reliefWalkNeedsWarning({ lowHeat: true, window: [45, 60] }, 50), false);
  assert.equal(reliefWalkNeedsWarning({ lowHeat: false, window: [10, 15] }, 8), true);
  assert.equal(reliefWalkNeedsWarning({ lowHeat: false, window: [10, 15] }, 2), false);
  assert.equal(reliefWalkNeedsWarning({ lowHeat: false, window: [10, 15] }, 2, 60), true);
  assert.equal(reliefWalkNeedsWarning({ lowHeat: true, window: null }, 2), true);
  assert.equal(reliefWalkNeedsWarning(null, 50), false);
});
