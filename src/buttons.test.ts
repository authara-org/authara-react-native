import { describe, expect, it } from "vitest";

import {
  appleButtonAppearance,
  autharaButtonLabel,
  googleButtonAppearance,
  microsoftButtonAppearance,
} from "./button-appearance.js";
import { resolveAutharaAction } from "./button-contract.js";
import {
  AutharaButtonError,
  autharaButtonErrorMessage,
  toAutharaButtonError,
} from "./button-error.js";
import { AutharaApiError } from "./client.js";

describe("provider buttons", () => {
  it("normalizes provider failures for the inline alert", () => {
    expect(autharaButtonErrorMessage(new Error("Provider unavailable"))).toBe(
      "Provider unavailable",
    );
    expect(autharaButtonErrorMessage("Unknown provider failure")).toBe(
      "Unknown provider failure",
    );
  });

  it("matches the shared button contract and Google mode defaults", () => {
    expect(autharaButtonLabel("sign-up", "Google")).toBe("Sign up with Google");
    expect(
      googleButtonAppearance({
        variant: "text",
        size: "large",
        mode: "light",
        shape: "rectangular",
        logoAlignment: "center",
      }),
    ).toMatchObject({
      height: 44,
      width: "100%",
      fill: "#ffffff",
      text: "#1f1f1f",
      border: "#747775",
      borderWidth: 1,
      borderRadius: 12,
    });
    expect(
      googleButtonAppearance({
        variant: "text",
        size: "large",
        mode: "dark",
        shape: "rectangular",
        logoAlignment: "center",
      }),
    ).toMatchObject({
      fill: "#ffffff",
      text: "#1f1f1f",
      border: "transparent",
      borderWidth: 0,
    });
    expect(
      googleButtonAppearance({
        variant: "text",
        size: "large",
        mode: "dark",
        theme: "dark",
        shape: "rectangular",
        logoAlignment: "center",
      }),
    ).toMatchObject({
      fill: "#131314",
      text: "#e3e3e3",
      border: "#8e918f",
    });
    expect(
      appleButtonAppearance({
        variant: "icon",
        size: "small",
        color: "white",
        border: false,
        borderRadius: 12,
        align: "center",
      }),
    ).toMatchObject({ height: 36, width: 36, fill: "#ffffff" });
    expect(
      microsoftButtonAppearance({
        variant: "provider",
        size: "medium",
        mode: "light",
        align: "left",
      }),
    ).toMatchObject({
      height: 36,
      fill: "#ffffff",
      text: "#1f1f1f",
      border: "#8c8c8c",
      borderWidth: 1,
      borderRadius: 12,
      iconLeft: 12,
    });
    expect(
      microsoftButtonAppearance({
        variant: "provider",
        size: "medium",
        mode: "dark",
        align: "left",
      }),
    ).toMatchObject({
      fill: "#ffffff",
      text: "#1f1f1f",
      border: "transparent",
      borderWidth: 0,
    });
  });

  it("validates Apple radius and action-specific required properties", () => {
    expect(() =>
      appleButtonAppearance({
        variant: "text",
        size: "large",
        color: "black",
        border: false,
        borderRadius: 51,
        align: "center",
      }),
    ).toThrow("between 0 and 50");
    expect(() =>
      resolveAutharaAction("reauthenticate", undefined, undefined, undefined),
    ).toThrow("authenticationChallengeId is required");
    expect(resolveAutharaAction("recover", "app", undefined, "link-1")).toEqual(
      { action: "recover", audience: "app", recoveryLinkId: "link-1" },
    );
  });

  it("preserves structured Authara errors for button consumers", () => {
    const original = new AutharaApiError(409, {
      error: { code: "account_link_required", message: "Prove ownership" },
      recovery: {
        link_id: "link-1",
        provider: "google",
        proof_methods: ["password"],
      },
    });
    const error = toAutharaButtonError(original, "Login failed", "provider");

    expect(error).toBeInstanceOf(AutharaButtonError);
    expect(error).toMatchObject({
      source: "authara",
      status: 409,
      code: "account_link_required",
      recovery: { link_id: "link-1" },
    });

    const unknown = toAutharaButtonError(
      new AutharaApiError(400, {
        error: { code: "future_core_code", message: "Future failure" },
      }),
      "Login failed",
      "provider",
    );
    expect(unknown).toMatchObject({
      code: "unknown_authara_error",
      serverCode: "future_core_code",
    });
  });
});
