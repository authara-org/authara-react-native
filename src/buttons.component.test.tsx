import { act, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root, type TestInstance } from "test-renderer";

import type {
  AutharaActionSuccess,
  AutharaProviderName,
  ResolvedAutharaAction,
} from "./button-contract.js";
import {
  AutharaProviderCancellationError,
  type AutharaButtonError,
} from "./button-error.js";
import { AutharaApiError } from "./client.js";

const testState = vi.hoisted(() => ({
  colorMode: "light" as "light" | "dark",
  client: {
    hasNativeProvider: vi.fn<(provider: AutharaProviderName) => boolean>(),
    runNativeProviderAction:
      vi.fn<
        (
          provider: AutharaProviderName,
          action: ResolvedAutharaAction,
        ) => Promise<AutharaActionSuccess<AutharaProviderName>>
      >(),
  },
}));

vi.mock("react-native", async () => {
  const React = await import("react");
  const component = (name: string) =>
    function MockComponent({ children, ...props }: Record<string, unknown>) {
      return React.createElement(name, props, children as ReactNode);
    };

  return {
    ActivityIndicator: component("ActivityIndicator"),
    Pressable: component("Pressable"),
    Text: component("Text"),
    View: component("View"),
    StyleSheet: { create: <T,>(styles: T) => styles },
    useColorScheme: () => testState.colorMode,
  };
});

vi.mock("react-native-svg", async () => {
  const React = await import("react");
  const component = (name: string) =>
    function MockComponent({ children, ...props }: Record<string, unknown>) {
      return React.createElement(name, props, children as ReactNode);
    };

  return {
    Path: component("Path"),
    Rect: component("Rect"),
    Svg: component("Svg"),
  };
});

vi.mock("./context.js", () => ({
  useAuthara: () => ({ client: testState.client }),
}));

import { AppleButton, GoogleButton, MicrosoftButton } from "./buttons.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];

const session = {
  access_token: "access-token",
  refresh_token: "refresh-token",
  user: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "user@example.com",
    email_verified: true,
    username: "user",
    disabled: false,
    created_at: "2026-10-16T20:00:00Z",
  },
};

function byType(root: Root, type: string): TestInstance[] {
  return root.container.queryAll((instance) => instance.type === type);
}

function byProps(root: Root, props: Record<string, unknown>): TestInstance[] {
  return root.container.queryAll((instance) =>
    Object.entries(props).every(
      ([key, value]) => instance.props[key] === value,
    ),
  );
}

function pressable(root: Root): TestInstance {
  return byType(root, "Pressable")[0];
}

function press(root: Root): void {
  pressable(root).props.onPress({ isDefaultPrevented: () => false });
}

async function render(node: ReactNode): Promise<Root> {
  const root = createRoot({ textComponentTypes: ["Text", "span"] });
  roots.push(root);
  await act(async () => {
    root.render(node as ReactElement);
  });
  return root;
}

beforeEach(() => {
  testState.colorMode = "light";
  testState.client.hasNativeProvider.mockReset().mockReturnValue(true);
  testState.client.runNativeProviderAction.mockReset();
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  vi.clearAllMocks();
});

describe("native provider button interactions", () => {
  it("renders an accessible Google button with its SVG mark", async () => {
    const root = await render(<GoogleButton />);

    expect(pressable(root).props).toMatchObject({
      accessibilityRole: "button",
      accessibilityLabel: "Sign in with Google",
      disabled: false,
    });
    expect(byType(root, "Svg")).toHaveLength(1);
    expect(byType(root, "Path")).toHaveLength(4);
  });

  it("renders the Apple and Microsoft SVG marks", async () => {
    const apple = await render(<AppleButton />);
    const microsoft = await render(<MicrosoftButton />);

    expect(pressable(apple).props.accessibilityLabel).toBe(
      "Sign in with Apple",
    );
    expect(byType(apple, "Path")).toHaveLength(1);
    expect(pressable(microsoft).props.accessibilityLabel).toBe(
      "Sign in with Microsoft",
    );
    expect(byType(microsoft, "Rect")).toHaveLength(4);
  });

  it("runs the selected action once and reports success", async () => {
    const onSuccess = vi.fn();
    let resolveAction:
      ((result: AutharaActionSuccess<"google">) => void) | undefined;
    testState.client.runNativeProviderAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );
    const root = await render(
      <GoogleButton action="login" audience="admin" onSuccess={onSuccess} />,
    );

    await act(async () => press(root));

    expect(testState.client.runNativeProviderAction).toHaveBeenCalledOnce();
    expect(testState.client.runNativeProviderAction).toHaveBeenCalledWith(
      "google",
      { action: "login", audience: "admin" },
    );
    expect(pressable(root).props).toMatchObject({
      disabled: true,
      accessibilityState: { disabled: true, busy: true },
    });
    expect(byType(root, "ActivityIndicator")).toHaveLength(1);

    await act(async () => {
      resolveAction?.({ action: "login", provider: "google", session });
    });

    expect(onSuccess).toHaveBeenCalledWith({
      action: "login",
      provider: "google",
      session,
    });
    expect(pressable(root).props.disabled).toBe(false);
  });

  it("provides structured Authara errors and lets the app hide inline UI", async () => {
    const onError = vi.fn<(error: AutharaButtonError) => void>();
    testState.client.runNativeProviderAction.mockRejectedValue(
      new AutharaApiError(409, {
        error: {
          code: "account_link_required",
          message: "Prove account ownership",
        },
        recovery: {
          link_id: "link-1",
          provider: "google",
          proof_methods: ["password"],
        },
      }),
    );
    const root = await render(
      <GoogleButton showError={false} onError={onError} />,
    );

    await act(async () => press(root));

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0]).toMatchObject({
      name: "AutharaButtonError",
      source: "authara",
      code: "account_link_required",
      status: 409,
      recovery: { link_id: "link-1" },
    });
    expect(byProps(root, { accessibilityRole: "alert" })).toHaveLength(0);
  });

  it("renders the accessible inline error by default", async () => {
    testState.client.runNativeProviderAction.mockRejectedValue(
      new Error("Provider unavailable"),
    );
    const root = await render(<GoogleButton />);

    await act(async () => press(root));

    const alert = byProps(root, { accessibilityRole: "alert" })[0];
    expect(alert.props.children).toBe("Provider unavailable");
  });

  it.each([
    ["Google", GoogleButton],
    ["Microsoft", MicrosoftButton],
  ] as const)(
    "routes %s cancellation separately from errors",
    async (provider, Button) => {
      const onCancel = vi.fn();
      const onError = vi.fn();
      testState.client.runNativeProviderAction.mockRejectedValue(
        new AutharaProviderCancellationError(provider),
      );
      const root = await render(
        <Button onCancel={onCancel} onError={onError} />,
      );

      await act(async () => press(root));

      expect(onCancel).toHaveBeenCalledOnce();
      expect(onError).not.toHaveBeenCalled();
      expect(byProps(root, { accessibilityRole: "alert" })).toHaveLength(0);
    },
  );

  it("renders the consumer fallback and announces unavailable adapters once", async () => {
    const onUnavailable = vi.fn();
    testState.client.hasNativeProvider.mockReturnValue(false);
    const root = await render(
      <GoogleButton
        fallback={<span>Google is unavailable</span>}
        onUnavailable={onUnavailable}
      />,
    );

    expect(byType(root, "span")[0].props.children).toBe(
      "Google is unavailable",
    );
    expect(byType(root, "Pressable")).toHaveLength(0);
    expect(onUnavailable).toHaveBeenCalledOnce();

    await act(async () =>
      root.render(
        <GoogleButton
          fallback={<span>Still unavailable</span>}
          onUnavailable={onUnavailable}
        />,
      ),
    );
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("turns success callback failures into consumer errors", async () => {
    const onError = vi.fn<(error: AutharaButtonError) => void>();
    testState.client.runNativeProviderAction.mockResolvedValue({
      action: "login",
      provider: "google",
      session,
    });
    const root = await render(
      <GoogleButton
        onSuccess={() => {
          throw new Error("Navigation failed");
        }}
        onError={onError}
      />,
    );

    await act(async () => press(root));

    expect(onError.mock.calls[0][0]).toMatchObject({
      source: "consumer",
      message: "Navigation failed",
    });
  });
});
