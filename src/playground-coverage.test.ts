import { describe, expect, it } from "vitest";

import { GeneratedAutharaApiClient } from "./generated/api.js";

const productUI = [
  "getCurrentAccount",
  "unlinkCurrentUserAuthMethod",
  "startCurrentUserEmailChange",
  "verifyCurrentUserEmailChange",
  "deleteCurrentUserPasskey",
  "addCurrentUserPassword",
  "changeCurrentUserPassword",
  "revokeCurrentUserOtherSessions",
  "revokeCurrentUserSession",
  "changeCurrentUsername",
  "getPublicCapabilities",
  "resendChallenge",
  "acceptInvitation",
  "loginAndAcceptInvitation",
  "previewInvitation",
  "listCurrentUserOrganizations",
  "getCurrentOrganization",
  "listCurrentOrganizationMembers",
  "getPublicOrganization",
  "updatePublicOrganization",
  "listPublicOrganizationInvitations",
  "getPublicOrganizationInvitation",
  "revokePublicOrganizationInvitation",
  "listPublicOrganizationMembers",
  "getPublicOrganizationMember",
  "updatePublicOrganizationMember",
  "switchOrganization",
  "startPasswordResetChallenge",
  "verifyPasswordResetChallenge",
  "completeAccountRecoveryLinkWithPassword",
  "checkRecentAuthentication",
  "reauthenticateWithPassword",
  "startSignupChallenge",
  "verifySignupChallenge",
  "signupDirect",
  "getCurrentUser",
  "listPublicUserMemberships",
] as const;

const nativeLibraryFlows = [
  "linkCurrentUserApple",
  "linkCurrentUserGoogle",
  "linkCurrentUserMicrosoft",
  "loginWithPassword",
  "loginWithApple",
  "getAppleLoginOptions",
  "loginWithGoogle",
  "getGoogleLoginOptions",
  "loginWithMicrosoft",
  "getMicrosoftLoginOptions",
  "completeAccountRecoveryLinkWithApple",
  "completeAccountRecoveryLinkWithGoogle",
  "completeAccountRecoveryLinkWithMicrosoft",
  "reauthenticateWithApple",
  "reauthenticateWithGoogle",
  "reauthenticateWithMicrosoft",
] as const;

// These do not belong in a product UI without a native adapter, or are handled
// internally by the token client instead of being exposed as buttons.
const intentionallyNotExposed = [
  "getCsrfToken",
  "authenticateAndAcceptInvitationWithGoogle",
  "finishPasskeyAuthentication",
  "beginPasskeyAuthentication",
  "finishPasskeyRegistration",
  "beginPasskeyRegistration",
  "startGoogleAccountRecoveryLink",
  "finishPasskeyReauthentication",
  "beginPasskeyReauthentication",
  "logout",
  "refreshSession",
  "refreshTokens",
  "revokeTokens",
  "setCurrentUserPassword",
] as const;

describe("mobile playground API coverage", () => {
  it("classifies every generated operation exactly once", () => {
    const classified = [
      ...productUI,
      ...nativeLibraryFlows,
      ...intentionallyNotExposed,
    ];
    const generated = Object.getOwnPropertyNames(
      GeneratedAutharaApiClient.prototype,
    ).filter((name) => name !== "constructor");

    expect(new Set(classified).size).toBe(classified.length);
    expect(classified.sort()).toEqual(generated.sort());
  });
});
