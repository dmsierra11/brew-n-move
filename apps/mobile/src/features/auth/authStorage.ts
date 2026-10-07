import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800;

function webGet(key: string) {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  return localStorage.getItem(key);
}

function webSet(key: string, value: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.setItem(key, value);
}

function webRemove(key: string) {
  if (typeof localStorage === 'undefined') {
    return;
  }

  localStorage.removeItem(key);
}

async function deleteNative(key: string) {
  const countRaw = await SecureStore.getItemAsync(`${key}.count`);
  if (countRaw) {
    const count = Number(countRaw);
    await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${index}`)),
    );
    await SecureStore.deleteItemAsync(`${key}.count`);
  }

  await SecureStore.deleteItemAsync(key);
}

export const authStorage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      return webGet(key);
    }

    const countRaw = await SecureStore.getItemAsync(`${key}.count`);
    if (!countRaw) {
      return SecureStore.getItemAsync(key);
    }

    const count = Number(countRaw);
    const parts = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    if (parts.some((part) => part == null)) {
      return null;
    }

    return parts.join('');
  },

  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      webSet(key, value);
      return;
    }

    await deleteNative(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}.count`, String(count));
    for (let index = 0; index < count; index += 1) {
      const part = value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
      await SecureStore.setItemAsync(`${key}.${index}`, part);
    }
  },

  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      webRemove(key);
      return;
    }

    await deleteNative(key);
  },
};
