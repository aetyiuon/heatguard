import { requireOptionalNativeModule } from 'expo';
import { WearableAdapter } from './wearable.types';
interface Bridge {
  available(): boolean;
  watchInstalled(): boolean;
  connect(): Promise<void>;
  latest(): Promise<unknown>;
  launchWatch(): Promise<void>;
  stopWatch(): Promise<void>;
  addListener(name: string, listener: (value: unknown) => void): { remove(): void };
}
const bridge = requireOptionalNativeModule<Bridge>('HeatGuardHealth');
export const wearable: WearableAdapter = {
  available: () => bridge?.available() ?? false,
  watchInstalled: () => bridge?.watchInstalled() ?? false,
  connect: async () => {
    if (!bridge) throw new Error('Rebuild the iPhone development app');
    await bridge.connect();
  },
  latest: async () => (bridge ? bridge.latest() : null),
  launchWatch: async () => {
    if (!bridge) throw new Error('Apple Watch companion required');
    await bridge.launchWatch();
  },
  stopWatch: async () => {
    await bridge?.stopWatch();
  },
  subscribe: (listener) => {
    const subscription = bridge?.addListener('heartRate', listener);
    return () => subscription?.remove();
  },
};
