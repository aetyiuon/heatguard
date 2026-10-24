export interface BiometricSample {
  bpm: number;
  at: number;
  source: 'apple-health' | 'apple-watch-live';
}
export function biometricSample(value: unknown, now: number): BiometricSample | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as BiometricSample;
  return Number.isFinite(s.bpm) &&
    s.bpm >= 25 &&
    s.bpm <= 250 &&
    Number.isFinite(s.at) &&
    s.at <= now + 5000 &&
    s.at >= now - 5 * 60000 &&
    (s.source === 'apple-health' || s.source === 'apple-watch-live')
    ? s
    : null;
}
export function biometricFresh(sample: BiometricSample | null, now: number) {
  return (
    !!sample &&
    !!biometricSample(sample, now) &&
    now - sample.at <= (sample.source === 'apple-watch-live' ? 30000 : 5 * 60000)
  );
}
