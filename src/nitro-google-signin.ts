import {
  GoogleOneTapSignIn,
  isCancelledResponse,
  isSuccessResponse,
} from "react-native-nitro-google-signin";
import { Platform } from "react-native";

import type { GoogleNativeAdapter } from "./native-client.js";

export interface NitroGoogleSignInOptions {
  iosClientId?: string;
}

export function createNitroGoogleSignIn(
  config: NitroGoogleSignInOptions = {},
): GoogleNativeAdapter {
  return {
    async authorize(options) {
      if (Platform.OS === "ios" && !config.iosClientId) {
        throw new Error(
          "Google native sign-in needs AUTHARA_OAUTH_GOOGLE_IOS_CLIENT_ID in the React Native .env",
        );
      }

      GoogleOneTapSignIn.configure({
        webClientId: options.client_id,
        iosClientId: config.iosClientId,
        nonce: options.nonce,
        autoSelectOnSignIn: false,
      });
      await GoogleOneTapSignIn.checkPlayServices(true);
      const response = await GoogleOneTapSignIn.presentExplicitSignIn();

      if (isCancelledResponse(response)) {
        throw new Error("Google sign-in was cancelled");
      }
      if (!isSuccessResponse(response) || !response.data.idToken) {
        throw new Error("Google did not return an ID token");
      }

      return { credential: response.data.idToken };
    },
  };
}
