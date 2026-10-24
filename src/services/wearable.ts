import { WearableAdapter } from './wearable.types';
/** Browser and Android never simulate an Apple Health connection. */
export const wearable: WearableAdapter = {
  available: () => false,
  watchInstalled: () => false,
  connect: async () => {
    throw new Error('iPhone native build required');
  },
  latest: async () => null,
  launchWatch: async () => {
    throw new Error('Apple Watch companion required');
  },
  stopWatch: async () => {},
  subscribe: () => () => {},
};
