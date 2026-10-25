import { PersonalCheckIn, Profile, Workload } from './types';
import { validCheckIn, CHECK_IN_MS } from './personal';

export const AI_CONDITIONS = [
  'cardiovascular',
  'diabetes',
  'respiratory',
  'kidney',
  'prior-heat-illness',
] as const;
export const AI_MEDICATIONS = [
  'diuretics',
  'beta-blockers',
  'antihistamines',
  'antipsychotics',
  'stimulants',
] as const;
export interface AiPersonalInput {
  profile: Profile;
  checkIn: PersonalCheckIn | null;
  workload: Workload;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: string[]) =>
  Object.keys(v).every((k) => allowed.includes(k));
const optionalNumber = (v: unknown, min: number, max: number) =>
  v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);
const list = (v: unknown, allowed: readonly string[]) =>
  Array.isArray(v) &&
  v.length <= allowed.length &&
  new Set(v).size === v.length &&
  v.every((x) => typeof x === 'string' && allowed.includes(x));

/** Strict user-entered wellness fields only: no identifiers, free text, routes or device history. */
export function parseAiPersonal(v: unknown, now: number): AiPersonalInput | null {
  if (!object(v) || Object.keys(v).sort().join(',') !== 'checkIn,profile,workload') return null;
  const p = v.profile;
  if (
    !object(p) ||
    !keys(p, [
      'age',
      'heightCm',
      'weightKg',
      'sex',
      'conditions',
      'medications',
      'fitness',
      'hydration',
      'shade',
      'water',
    ])
  )
    return null;
  if (
    !optionalNumber(p.age, 18, 120) ||
    !optionalNumber(p.heightCm, 40, 250) ||
    !optionalNumber(p.weightKg, 5, 400)
  )
    return null;
  if (p.sex !== undefined && !['female', 'male', 'intersex'].includes(p.sex as string)) return null;
  if (
    !list(p.conditions, AI_CONDITIONS) ||
    !list(p.medications, AI_MEDICATIONS) ||
    !['unknown', 'sedentary', 'lightly-active', 'very-active', 'acclimatized'].includes(
      p.fitness as string,
    ) ||
    !['adequate', 'unsure', 'low'].includes(p.hydration as string) ||
    typeof p.shade !== 'boolean' ||
    typeof p.water !== 'boolean'
  )
    return null;
  if (!['resting', 'light', 'moderate', 'heavy'].includes(v.workload as string)) return null;
  const c = v.checkIn;
  if (c !== null) {
    if (
      !object(c) ||
      !keys(c, ['at', 'feeling', 'hydration', 'clothing', 'heartRate', 'temperature'])
    )
      return null;
    if (
      c.heartRate !== undefined &&
      (!object(c.heartRate) || Object.keys(c.heartRate).sort().join(',') !== 'at,bpm,context')
    )
      return null;
    if (
      c.temperature !== undefined &&
      (!object(c.temperature) || Object.keys(c.temperature).sort().join(',') !== 'at,c,method')
    )
      return null;
    if (!validCheckIn(c as unknown as PersonalCheckIn, now) || now - (c.at as number) > CHECK_IN_MS)
      return null;
  }
  return projectAiPersonal(
    p as unknown as Profile,
    c as unknown as PersonalCheckIn | null,
    v.workload as Workload,
  );
}

/** Explicit projection. Never replace with a spread of state/profile/check-in. */
export function projectAiPersonal(
  p: Profile,
  c: PersonalCheckIn | null,
  workload: Workload,
): AiPersonalInput {
  return {
    profile: {
      age: p.age,
      heightCm: p.heightCm,
      weightKg: p.weightKg,
      sex: p.sex,
      conditions: [...p.conditions],
      medications: [...p.medications],
      fitness: p.fitness,
      hydration: p.hydration,
      shade: p.shade,
      water: p.water,
    },
    checkIn: c
      ? {
          at: c.at,
          feeling: c.feeling,
          hydration: c.hydration,
          clothing: c.clothing,
          ...(c.heartRate
            ? {
                heartRate: {
                  bpm: c.heartRate.bpm,
                  at: c.heartRate.at,
                  context: c.heartRate.context,
                },
              }
            : {}),
          ...(c.temperature
            ? {
                temperature: {
                  c: c.temperature.c,
                  at: c.temperature.at,
                  method: c.temperature.method,
                },
              }
            : {}),
        }
      : null,
    workload,
  };
}
