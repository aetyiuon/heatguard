/** Legacy resting-pulse interface; automatic resting-context detection remains unavailable.
 * The optional Apple Health / live Watch context feed is implemented in wearable.ios.ts.
 * Do not treat an exercise reading as a rested measurement or feed it into resting thresholds. */
export interface HeartRateSample {
  bpm: number;
  at: number;
  context: 'resting' | 'active';
}
export interface HealthAdapter {
  available(): Promise<boolean>;
  requestConsent(): Promise<boolean>;
  readRestingHeartRate(): Promise<HeartRateSample | null>;
}
export const healthAdapter: HealthAdapter = {
  available: async () => false,
  requestConsent: async () => false,
  readRestingHeartRate: async () => null,
};
