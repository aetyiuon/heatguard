/** Native integration boundary. HealthKit/Health Connect require dedicated adapters,
 * entitlements, explicit consent, and on-device data validation. No fake pulse data. */
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
