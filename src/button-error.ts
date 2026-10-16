import { AutharaApiError } from "./client.js";
import {
  autharaActionErrorCodes,
  type AutharaContractErrorCode,
} from "./generated/error-codes.js";
import type { AccountRecoveryLink } from "./generated/types.js";

export type AutharaButtonErrorSource =
  "authara" | "provider" | "configuration" | "consumer";

export type AutharaLocalErrorCode = "unknown_authara_error";
export type AutharaLoginErrorCode =
  AutharaContractErrorCode<"login"> | AutharaLocalErrorCode;
export type AutharaLinkErrorCode =
  AutharaContractErrorCode<"link"> | AutharaLocalErrorCode;
export type AutharaReauthenticationErrorCode =
  AutharaContractErrorCode<"reauthenticate"> | AutharaLocalErrorCode;
export type AutharaRecoveryErrorCode =
  AutharaContractErrorCode<"recover"> | AutharaLocalErrorCode;
export type AutharaButtonErrorCode =
  | AutharaLoginErrorCode
  | AutharaLinkErrorCode
  | AutharaReauthenticationErrorCode
  | AutharaRecoveryErrorCode;

const knownAutharaErrorCodes = new Set<string>([
  ...autharaActionErrorCodes.login,
  ...autharaActionErrorCodes.link,
  ...autharaActionErrorCodes.reauthenticate,
  ...autharaActionErrorCodes.recover,
]);

export class AutharaButtonError<
  Code extends string = AutharaButtonErrorCode,
> extends Error {
  readonly source: AutharaButtonErrorSource;
  readonly code?: Code;
  readonly serverCode?: string;
  readonly status?: number;
  readonly authenticationChallenge?: { id: string; expires_at: string };
  readonly reauthenticateUrl?: string;
  readonly recovery?: AccountRecoveryLink;
  readonly originalError: unknown;

  constructor(
    message: string,
    source: AutharaButtonErrorSource,
    originalError: unknown,
    metadata: {
      code?: string;
      serverCode?: string;
      status?: number;
      authenticationChallenge?: { id: string; expires_at: string };
      reauthenticateUrl?: string;
      recovery?: AccountRecoveryLink;
    } = {},
  ) {
    super(message);
    this.name = "AutharaButtonError";
    this.source = source;
    this.originalError = originalError;
    this.code = metadata.code as Code | undefined;
    this.serverCode = metadata.serverCode;
    this.status = metadata.status;
    this.authenticationChallenge = metadata.authenticationChallenge;
    this.reauthenticateUrl = metadata.reauthenticateUrl;
    this.recovery = metadata.recovery;
  }
}

export class AutharaProviderCancellationError extends Error {
  constructor(provider: string) {
    super(`${provider} sign-in was cancelled`);
    this.name = "AutharaProviderCancellationError";
  }
}

export function isAutharaButtonError(
  error: unknown,
): error is AutharaButtonError {
  return error instanceof AutharaButtonError;
}

export function isAutharaProviderCancellation(
  error: unknown,
): error is AutharaProviderCancellationError {
  return error instanceof AutharaProviderCancellationError;
}

export function toAutharaButtonError(
  error: unknown,
  fallback: string,
  source: AutharaButtonErrorSource,
): AutharaButtonError {
  if (error instanceof AutharaButtonError) return error;

  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string" &&
          error.message.trim()
        ? error.message.trim()
        : fallback;

  if (error instanceof AutharaApiError) {
    const knownCode =
      error.code !== undefined && knownAutharaErrorCodes.has(error.code);
    return new AutharaButtonError(message, "authara", error, {
      code: knownCode ? error.code : "unknown_authara_error",
      serverCode: knownCode ? undefined : error.code,
      status: error.status,
      authenticationChallenge: error.details?.authentication_challenge,
      reauthenticateUrl: error.details?.reauthenticate_url,
      recovery: error.details?.recovery,
    });
  }

  return new AutharaButtonError(message, source, error);
}

export function autharaButtonErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
