import type { AutharaAudience, AutharaClientOptions } from "./client.js";
import type {
  AutharaActionSuccess,
  AutharaProviderName,
  ResolvedAutharaAction,
} from "./button-contract.js";
import { GeneratedAutharaApiClient } from "./generated/api.js";
import type {
  AppleLoginOptions,
  AuthSession,
  GoogleLoginOptions,
  MicrosoftLoginOptions,
} from "./generated/types.js";

export interface GoogleNativeAdapter {
  authorize(options: GoogleLoginOptions): Promise<{ credential: string }>;
}

export interface AppleNativeAdapter {
  authorize(options: AppleLoginOptions): Promise<{ code: string }>;
}

export interface MicrosoftNativeAdapter {
  authorize(options: MicrosoftLoginOptions): Promise<{ credential: string }>;
}

export interface AutharaNativeProviders {
  google?: GoogleNativeAdapter;
  apple?: AppleNativeAdapter;
  microsoft?: MicrosoftNativeAdapter;
}

export interface AutharaNativeClientOptions extends AutharaClientOptions {
  providers?: AutharaNativeProviders;
}

export class AutharaNativeClient extends GeneratedAutharaApiClient {
  private readonly providers: AutharaNativeProviders;

  constructor(options: AutharaNativeClientOptions) {
    super(options);
    this.providers = options.providers ?? {};
  }

  async restore(): Promise<boolean> {
    if (!(await this.restoreTokens())) return false;
    try {
      this.setCurrentUser(await this.getCurrentUser());
      return true;
    } catch {
      return false;
    }
  }

  signInWithPassword(
    identifier: string,
    password: string,
    audience: AutharaAudience = "app",
  ): Promise<AuthSession> {
    return this.loginWithPassword({
      audience,
      session_transport: "token",
      body: { identifier, password },
    });
  }

  async signInWithGoogle(
    audience: AutharaAudience = "app",
  ): Promise<AuthSession> {
    const result = await this.runNativeProviderAction("google", {
      action: "login",
      audience,
    });
    if (result.action !== "login") throw new Error("Unexpected Google action");
    return result.session;
  }

  async signInWithApple(
    audience: AutharaAudience = "app",
  ): Promise<AuthSession> {
    const result = await this.runNativeProviderAction("apple", {
      action: "login",
      audience,
    });
    if (result.action !== "login") throw new Error("Unexpected Apple action");
    return result.session;
  }

  async signInWithMicrosoft(
    audience: AutharaAudience = "app",
  ): Promise<AuthSession> {
    const result = await this.runNativeProviderAction("microsoft", {
      action: "login",
      audience,
    });
    if (result.action !== "login")
      throw new Error("Unexpected Microsoft action");
    return result.session;
  }

  hasNativeProvider(provider: AutharaProviderName): boolean {
    return this.providers[provider] !== undefined;
  }

  runNativeProviderAction<P extends AutharaProviderName>(
    provider: P,
    action: ResolvedAutharaAction,
  ): Promise<AutharaActionSuccess<P>> {
    switch (provider) {
      case "google":
        return this.runGoogleAction(action) as Promise<AutharaActionSuccess<P>>;
      case "apple":
        return this.runAppleAction(action) as Promise<AutharaActionSuccess<P>>;
      case "microsoft":
        return this.runMicrosoftAction(action) as Promise<
          AutharaActionSuccess<P>
        >;
    }
  }

  private async runGoogleAction(
    action: ResolvedAutharaAction,
  ): Promise<AutharaActionSuccess<"google">> {
    const adapter = this.requireProvider("google", this.providers.google);
    const options = await this.getGoogleLoginOptions({
      session_transport: "token",
    });
    const proof = await adapter.authorize(options);
    const body = {
      credential: proof.credential,
      nonce: options.nonce,
      challenge_id: options.challenge_id,
    };

    switch (action.action) {
      case "login":
        return {
          action: "login",
          provider: "google",
          session: await this.loginWithGoogle({
            audience: action.audience,
            session_transport: "token",
            body,
          }),
        };
      case "link":
        await this.linkCurrentUserGoogle({ body });
        return { action: "link", provider: "google" };
      case "reauthenticate":
        await this.reauthenticateWithGoogle({
          body: {
            credential: proof.credential,
            nonce: options.nonce,
            authentication_challenge_id: action.authenticationChallengeId,
          },
        });
        return { action: "reauthenticate", provider: "google" };
      case "recover":
        return {
          action: "recover",
          provider: "google",
          session: await this.completeAccountRecoveryLinkWithGoogle({
            linkID: action.recoveryLinkId,
            audience: action.audience,
            body,
          }),
        };
    }
  }

  private async runAppleAction(
    action: ResolvedAutharaAction,
  ): Promise<AutharaActionSuccess<"apple">> {
    const adapter = this.requireProvider("apple", this.providers.apple);
    const options = await this.getAppleLoginOptions({
      session_transport: "token",
    });
    const proof = await adapter.authorize(options);
    const body = {
      code: proof.code,
      state: options.state,
      challenge_id: options.challenge_id,
    };

    switch (action.action) {
      case "login":
        return {
          action: "login",
          provider: "apple",
          session: await this.loginWithApple({
            audience: action.audience,
            session_transport: "token",
            body,
          }),
        };
      case "link":
        await this.linkCurrentUserApple({ body });
        return { action: "link", provider: "apple" };
      case "reauthenticate":
        await this.reauthenticateWithApple({
          body: {
            code: proof.code,
            state: options.state,
            challenge_id: options.challenge_id,
            authentication_challenge_id: action.authenticationChallengeId,
          },
        });
        return { action: "reauthenticate", provider: "apple" };
      case "recover":
        return {
          action: "recover",
          provider: "apple",
          session: await this.completeAccountRecoveryLinkWithApple({
            linkID: action.recoveryLinkId,
            audience: action.audience,
            body,
          }),
        };
    }
  }

  private async runMicrosoftAction(
    action: ResolvedAutharaAction,
  ): Promise<AutharaActionSuccess<"microsoft">> {
    const adapter = this.requireProvider("microsoft", this.providers.microsoft);
    const options = await this.getMicrosoftLoginOptions({
      session_transport: "token",
    });
    const proof = await adapter.authorize(options);
    const body = {
      credential: proof.credential,
      nonce: options.nonce,
      challenge_id: options.challenge_id,
    };

    switch (action.action) {
      case "login":
        return {
          action: "login",
          provider: "microsoft",
          session: await this.loginWithMicrosoft({
            audience: action.audience,
            session_transport: "token",
            body,
          }),
        };
      case "link":
        await this.linkCurrentUserMicrosoft({ body });
        return { action: "link", provider: "microsoft" };
      case "reauthenticate":
        await this.reauthenticateWithMicrosoft({
          body: {
            credential: proof.credential,
            nonce: options.nonce,
            authentication_challenge_id: action.authenticationChallengeId,
          },
        });
        return { action: "reauthenticate", provider: "microsoft" };
      case "recover":
        return {
          action: "recover",
          provider: "microsoft",
          session: await this.completeAccountRecoveryLinkWithMicrosoft({
            linkID: action.recoveryLinkId,
            audience: action.audience,
            body,
          }),
        };
    }
  }

  private requireProvider<T>(name: string, adapter: T | undefined): T {
    if (!adapter)
      throw new Error(`Authara ${name} native adapter is not configured`);
    return adapter;
  }
}

export function createAuthara(
  options: AutharaNativeClientOptions,
): AutharaNativeClient {
  return new AutharaNativeClient(options);
}
