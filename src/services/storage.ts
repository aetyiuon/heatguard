import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
const volatile = new Map<string, unknown>();
export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const value = await AsyncStorage.getItem(`hg.v1.${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}
export async function writeLocal(key: string, value: unknown) {
  await AsyncStorage.setItem(`hg.v1.${key}`, JSON.stringify(value));
}
export async function readPrivate<T>(key: string, fallback: T): Promise<T> {
  if (Platform.OS === 'web') return (volatile.get(key) as T) ?? fallback;
  const value = await SecureStore.getItemAsync(`hg.v1.${key}`);
  return value ? JSON.parse(value) : fallback;
}
export async function writePrivate(key: string, value: unknown) {
  if (Platform.OS === 'web') {
    volatile.set(key, value);
    return;
  }
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > 1900)
    throw new Error('Keep this optional profile short enough for encrypted device storage.');
  await SecureStore.setItemAsync(`hg.v1.${key}`, text, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
}
export async function clearPrivate(key: string) {
  if (Platform.OS === 'web') volatile.delete(key);
  else await SecureStore.deleteItemAsync(`hg.v1.${key}`);
}
export async function clearLocal() {
  const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('hg.v1.'));
  await AsyncStorage.multiRemove(keys);
}
