import * as SecureStore from "expo-secure-store";

import type { AutharaTokenStorage } from "./storage.js";

export interface ExpoSecureStoreOptions extends SecureStore.SecureStoreOptions {
  key?: string;
}

export function createExpoSecureStore(
  options: ExpoSecureStoreOptions = {},
): AutharaTokenStorage {
  const { key = "authara.refresh-token", ...secureStoreOptions } = options;
  return {
    getRefreshToken: () => SecureStore.getItemAsync(key, secureStoreOptions),
    setRefreshToken: (token) =>
      SecureStore.setItemAsync(key, token, secureStoreOptions),
    removeRefreshToken: () =>
      SecureStore.deleteItemAsync(key, secureStoreOptions),
  };
}
