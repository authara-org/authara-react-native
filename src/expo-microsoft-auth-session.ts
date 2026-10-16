import {
  AuthRequest,
  Prompt,
  ResponseType,
  exchangeCodeAsync,
  fetchDiscoveryAsync,
  makeRedirectUri,
} from "expo-auth-session";

import { AutharaProviderCancellationError } from "./button-error.js";
import type { MicrosoftNativeAdapter } from "./native-client.js";

export interface ExpoMicrosoftAuthSessionOptions {
  redirectUri?: string;
  scheme?: string;
  path?: string;
}

export function createExpoMicrosoftAuthSession(
  config: ExpoMicrosoftAuthSessionOptions = {},
): MicrosoftNativeAdapter {
  return {
    async authorize(options) {
      const redirectUri =
        config.redirectUri ??
        makeRedirectUri({
          scheme: config.scheme,
          path: config.path ?? "microsoft",
        });
      const issuer = `${options.authority.replace(/\/$/, "")}/v2.0`;
      const discovered = await fetchDiscoveryAsync(issuer);
      if (!discovered.authorizationEndpoint || !discovered.tokenEndpoint) {
        throw new Error("Microsoft OpenID discovery is incomplete");
      }
      const discovery = {
        authorizationEndpoint: discovered.authorizationEndpoint,
        tokenEndpoint: discovered.tokenEndpoint,
      };
      const scopes = ["openid", "profile", "email"];
      const request = new AuthRequest({
        clientId: options.client_id,
        redirectUri,
        responseType: ResponseType.Code,
        scopes,
        prompt: Prompt.SelectAccount,
        usePKCE: true,
        extraParams: { nonce: options.nonce },
      });
      const result = await request.promptAsync(discovery, {
        preferEphemeralSession: true,
      });

      if (result.type !== "success") {
        if (result.type === "cancel" || result.type === "dismiss") {
          throw new AutharaProviderCancellationError("Microsoft");
        }
        const message =
          result.type === "error" ? result.error?.description : undefined;
        throw new Error(message ?? "Microsoft sign-in failed");
      }
      const code = result.params.code;
      if (!code || !request.codeVerifier) {
        throw new Error("Microsoft did not return a usable authorization code");
      }

      const tokens = await exchangeCodeAsync(
        {
          clientId: options.client_id,
          code,
          redirectUri,
          scopes,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery,
      );
      if (!tokens.idToken) {
        throw new Error("Microsoft did not return an ID token");
      }

      return { credential: tokens.idToken };
    },
  };
}
