import type { AutharaAudience } from "./client.js";
import type {
  AutharaButtonError,
  AutharaLinkErrorCode,
  AutharaLoginErrorCode,
  AutharaRecoveryErrorCode,
  AutharaReauthenticationErrorCode,
} from "./button-error.js";
import type { AccountRecoveryLink, AuthSession } from "./generated/types.js";

export type MaybePromise<T> = T | Promise<T>;
export type AutharaAction = "login" | "link" | "reauthenticate" | "recover";
export type AutharaProviderName = "apple" | "google" | "microsoft";
export type AutharaAccountRecoveryLink = AccountRecoveryLink;

export type AutharaLoginSuccess<P extends AutharaProviderName> = {
  action: "login";
  provider: P;
  session: AuthSession;
};

export type AutharaLinkSuccess<P extends AutharaProviderName> = {
  action: "link";
  provider: P;
};

export type AutharaReauthenticationSuccess<P extends AutharaProviderName> = {
  action: "reauthenticate";
  provider: P;
};

export type AutharaRecoverySuccess<P extends AutharaProviderName> = {
  action: "recover";
  provider: P;
  session: AuthSession;
};

export type AutharaActionSuccess<P extends AutharaProviderName> =
  | AutharaLoginSuccess<P>
  | AutharaLinkSuccess<P>
  | AutharaReauthenticationSuccess<P>
  | AutharaRecoverySuccess<P>;

export type AutharaActionProps<P extends AutharaProviderName> =
  | {
      action?: "login";
      audience?: AutharaAudience;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      onSuccess?: (result: AutharaLoginSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLoginErrorCode>) => void;
    }
  | {
      action: "link";
      audience?: never;
      authenticationChallengeId?: never;
      recoveryLinkId?: never;
      onSuccess?: (result: AutharaLinkSuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaLinkErrorCode>) => void;
    }
  | {
      action: "reauthenticate";
      audience?: never;
      authenticationChallengeId: string;
      recoveryLinkId?: never;
      onSuccess?: (
        result: AutharaReauthenticationSuccess<P>,
      ) => MaybePromise<void>;
      onError?: (
        error: AutharaButtonError<AutharaReauthenticationErrorCode>,
      ) => void;
    }
  | {
      action: "recover";
      audience?: "app";
      authenticationChallengeId?: never;
      recoveryLinkId: AccountRecoveryLink["link_id"];
      onSuccess?: (result: AutharaRecoverySuccess<P>) => MaybePromise<void>;
      onError?: (error: AutharaButtonError<AutharaRecoveryErrorCode>) => void;
    };

export type ResolvedAutharaAction =
  | { action: "login"; audience: AutharaAudience }
  | { action: "link" }
  | { action: "reauthenticate"; authenticationChallengeId: string }
  | { action: "recover"; audience: "app"; recoveryLinkId: string };

export function resolveAutharaAction(
  action: AutharaAction | undefined,
  audience: AutharaAudience | undefined,
  authenticationChallengeId: string | undefined,
  recoveryLinkId: string | undefined,
): ResolvedAutharaAction {
  if (action === "link") return { action };
  if (action === "reauthenticate") {
    if (!authenticationChallengeId) {
      throw new Error(
        "authenticationChallengeId is required for reauthentication.",
      );
    }
    return { action, authenticationChallengeId };
  }
  if (action === "recover") {
    if (!recoveryLinkId) {
      throw new Error("recoveryLinkId is required for account recovery.");
    }
    return { action, audience: "app", recoveryLinkId };
  }
  return { action: "login", audience: audience ?? "app" };
}
