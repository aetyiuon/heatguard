import { Profile } from './types';

export type ProfileNumbers = Pick<Profile, 'age' | 'heightCm' | 'weightKg'>;
export type ProfileNumberDraft = Record<keyof ProfileNumbers, string>;

export function profileNumberDraft(profile: ProfileNumbers): ProfileNumberDraft {
  return {
    age: profile.age?.toString() ?? '',
    heightCm: profile.heightCm?.toString() ?? '',
    weightKg: profile.weightKg?.toString() ?? '',
  };
}

/** Parse only when saving, so intermediate input such as "70." remains editable. */
export function parseProfileNumbers(draft: ProfileNumberDraft): ProfileNumbers | null {
  const result: ProfileNumbers = {};
  for (const [key, min, max] of [
    ['age', 18, 120],
    ['heightCm', 40, 250],
    ['weightKg', 5, 400],
  ] as const) {
    const text = draft[key].trim();
    const value = text ? Number(text.replace(',', '.')) : undefined;
    if (value !== undefined && (!Number.isFinite(value) || value < min || value > max)) return null;
    result[key] = value;
  }
  return result;
}
