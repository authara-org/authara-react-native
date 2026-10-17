import { beforeEach, describe, expect, it, vi } from "vitest";

const nitro = vi.hoisted(() => ({
  configure: vi.fn(),
  checkPlayServices: vi.fn(async () => undefined),
  presentExplicitSignIn: vi.fn(async () => ({
    data: { idToken: "google-id-token" },
  })),
}));

vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("react-native-nitro-google-signin", () => ({
  GoogleOneTapSignIn: nitro,
  isCancelledResponse: () => false,
  isSuccessResponse: () => true,
}));

import { Platform } from "react-native";

import { createNitroGoogleSignIn } from "./nitro-google-signin.js";

describe("createNitroGoogleSignIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
  });

  it("allows Android sign-in without an iOS client ID", async () => {
    const adapter = createNitroGoogleSignIn();

    await expect(
      adapter.authorize({
        client_id: "google-web-client",
        nonce: "nonce",
        challenge_id: "challenge",
      }),
    ).resolves.toEqual({ credential: "google-id-token" });
    expect(nitro.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: "google-web-client",
        iosClientId: undefined,
      }),
    );
  });

  it("requires an iOS client ID on iOS", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });

    await expect(
      createNitroGoogleSignIn().authorize({
        client_id: "google-web-client",
        nonce: "nonce",
        challenge_id: "challenge",
      }),
    ).rejects.toThrow("AUTHARA_OAUTH_GOOGLE_IOS_CLIENT_ID");
    expect(nitro.configure).not.toHaveBeenCalled();
  });
});
