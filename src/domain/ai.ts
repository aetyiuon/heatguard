/** The complete public-only AI contract. Never extend it with profile or route data. */
export const AI_PROVIDER = 'groq' as const;
export const AI_MODEL = 'openai/gpt-oss-20b' as const;
export const AI_CITIES = ['arlington', 'dallas', 'fort-worth'] as const;
export type AiCity = (typeof AI_CITIES)[number];
export const AI_CITY_NAMES: Record<AiCity, string> = {
  arlington: 'Arlington',
  dallas: 'Dallas',
  'fort-worth': 'Fort Worth',
};
export const AI_ACTIONS = [
  'check-forecast',
  'review-relief',
  'verify-access',
  'bring-water',
  'choose-shade',
] as const;
export type AiAction = (typeof AI_ACTIONS)[number];
export interface AiRequest {
  city: AiCity;
  language: 'en' | 'es';
  adult: true;
  consent: true;
}
export interface AiText {
  summary: string;
  actions: AiAction[];
}
export interface AiOutlookResult extends AiText {
  city: AiCity;
  language: 'en' | 'es';
  generatedAt: string;
  expiresAt: string;
  weatherTime: string;
  temperatureC: number;
  humidity: number;
  sources: string[];
  provider: typeof AI_PROVIDER;
  model: string;
}
export function parseAiRequest(value: unknown): AiRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'adult,city,consent,language') return null;
  if (
    v.adult !== true ||
    v.consent !== true ||
    !AI_CITIES.includes(v.city as AiCity) ||
    !['en', 'es'].includes(v.language as string)
  )
    return null;
  return v as unknown as AiRequest;
}
/** Reject malformed/unexpected output; this is not medical validation of generated text. */
export function parseAiText(value: unknown): AiText | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'actions,summary') return null;
  if (typeof v.summary !== 'string' || !v.summary.trim() || v.summary.length > 550) return null;
  // Only qualitative weather prose is allowed. Times and medical conclusions have no AI field.
  if (
    /[\d<>]|https?:|www\.|\b(safe|safely|unsafe|guarantee\w*|diagnos\w*|symptom\w*|heatstroke|minute\w*|hour\w*|segur[oa]\w*|garanti\w*|diagn[oó]st\w*|s[ií]ntoma\w*|minuto\w*|hora\w*)\b/i.test(
      v.summary,
    )
  )
    return null;
  if (
    !Array.isArray(v.actions) ||
    v.actions.length < 2 ||
    v.actions.length > 4 ||
    new Set(v.actions).size !== v.actions.length ||
    !v.actions.every((a) => AI_ACTIONS.includes(a as AiAction))
  )
    return null;
  return { summary: v.summary.trim(), actions: v.actions as AiAction[] };
}

export function parseAiResult(value: unknown, now: number): AiOutlookResult | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (!parseAiText({ summary: v.summary, actions: v.actions })) return null;
  if (!AI_CITIES.includes(v.city as AiCity) || !['en', 'es'].includes(v.language as string))
    return null;
  if (v.provider !== AI_PROVIDER || v.model !== AI_MODEL) return null;
  for (const key of ['generatedAt', 'expiresAt', 'weatherTime']) {
    if (typeof v[key] !== 'string' || !Number.isFinite(Date.parse(v[key]))) return null;
  }
  const generated = Date.parse(v.generatedAt as string),
    expires = Date.parse(v.expiresAt as string),
    reading = Date.parse(v.weatherTime as string);
  if (
    generated > now + 60_000 ||
    expires <= now ||
    expires > generated + 600_000 ||
    reading > now + 600_000 ||
    now - reading > 3_600_000
  )
    return null;
  if (
    typeof v.temperatureC !== 'number' ||
    !Number.isFinite(v.temperatureC) ||
    v.temperatureC < -90 ||
    v.temperatureC > 65 ||
    typeof v.humidity !== 'number' ||
    !Number.isFinite(v.humidity) ||
    v.humidity < 0 ||
    v.humidity > 100
  )
    return null;
  if (
    !Array.isArray(v.sources) ||
    v.sources.length > 8 ||
    !v.sources.every((s) => typeof s === 'string' && s.length <= 300)
  )
    return null;
  return v as unknown as AiOutlookResult;
}
