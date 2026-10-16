// Code generated from authara-core/contract/openapi.yaml; DO NOT EDIT.

export const autharaActionErrorCodes = {
  login: [
    "account_link_required",
    "forbidden",
    "internal_error",
    "invalid_request",
    "not_found",
    "unauthorized",
  ],
  link: [
    "auth_method_already_linked",
    "forbidden",
    "internal_error",
    "invalid_request",
    "not_found",
    "recent_authentication_required",
    "unauthorized",
  ],
  reauthenticate: [
    "internal_error",
    "invalid_authentication_challenge",
    "invalid_request",
    "not_found",
    "unauthorized",
  ],
  recover: [
    "auth_method_already_linked",
    "forbidden",
    "internal_error",
    "invalid_request",
    "invitation_already_accepted",
    "invitation_email_mismatch",
    "invitation_expired",
    "invitation_not_found",
    "invitation_revoked",
    "not_found",
    "organization_membership_conflict",
    "provider_link_expired",
    "unauthorized",
  ],
} as const;

export type AutharaContractAction = keyof typeof autharaActionErrorCodes;

export type AutharaContractErrorCode<Action extends AutharaContractAction> =
  (typeof autharaActionErrorCodes)[Action][number];
