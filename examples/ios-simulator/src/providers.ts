import Constants from "expo-constants";
import { createExpoAppleAuthentication } from "@authara/react-native/expo-apple-authentication";
import { createExpoMicrosoftAuthSession } from "@authara/react-native/expo-microsoft-auth-session";
import { createNitroGoogleSignIn } from "@authara/react-native/nitro-google-signin";

const extra = Constants.expoConfig?.extra as
  | {
      autharaGoogleIosClientId?: string | null;
      autharaMicrosoftRedirectUri?: string | null;
    }
  | undefined;

export const nativeProviders = {
  apple: createExpoAppleAuthentication(),
  google: createNitroGoogleSignIn({
    iosClientId: extra?.autharaGoogleIosClientId || undefined,
  }),
  microsoft: createExpoMicrosoftAuthSession({
    redirectUri: extra?.autharaMicrosoftRedirectUri || undefined,
  }),
};
