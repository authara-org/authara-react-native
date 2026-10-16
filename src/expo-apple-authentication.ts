import * as AppleAuthentication from "expo-apple-authentication";

import { AutharaProviderCancellationError } from "./button-error.js";
import type { AppleNativeAdapter } from "./native-client.js";

export function createExpoAppleAuthentication(): AppleNativeAdapter {
  return {
    async authorize(options) {
      if (!(await AppleAuthentication.isAvailableAsync())) {
        throw new Error("Sign in with Apple is not available on this device");
      }

      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          nonce: options.nonce,
          state: options.state,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          ],
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "ERR_REQUEST_CANCELED"
        ) {
          throw new AutharaProviderCancellationError("Apple");
        }
        throw error;
      }

      if (!credential.authorizationCode) {
        throw new Error("Apple did not return an authorization code");
      }
      if (credential.state && credential.state !== options.state) {
        throw new Error("Apple returned an unexpected OAuth state");
      }

      return { code: credential.authorizationCode };
    },
  };
}
