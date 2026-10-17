import { describe, expect, it, vi } from "vitest";

import { createAuthara } from "./native-client.js";
import { createMemoryTokenStorage } from "./storage.js";

const user = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "mobile@example.com",
  email_verified: true,
  username: "mobile",
  disabled: false,
  created_at: "2026-10-15T12:00:00Z",
};

function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? undefined : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AutharaNativeClient", () => {
  it("requires HTTPS unless insecure HTTP is explicitly enabled", () => {
    const storage = createMemoryTokenStorage();
    expect(() =>
      createAuthara({ baseUrl: "http://auth.example.com", storage }),
    ).toThrow("must use HTTPS");
    expect(() =>
      createAuthara({
        baseUrl: "http://localhost:3002",
        storage,
        allowInsecureHttp: true,
      }),
    ).not.toThrow();
    expect(() =>
      createAuthara({
        baseUrl: "ftp://auth.example.com",
        storage,
        allowInsecureHttp: true,
      }),
    ).toThrow("must use HTTPS");
    expect(() => createAuthara({ baseUrl: "not a URL", storage })).toThrow();
  });

  it("persists refresh tokens, keeps access tokens in memory, and sends bearer auth", async () => {
    const storage = createMemoryTokenStorage();
    const fetch = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const authorization = new Headers(init?.headers).get("Authorization");
        if (authorization) {
          expect(authorization).toBe("Bearer access-1");
          return json(200, user);
        }
        return json(200, {
          user,
          access_token: "access-1",
          refresh_token: "refresh-1",
        });
      },
    );
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch,
    });

    await client.signInWithPassword("mobile@example.com", "password");
    await client.getCurrentUser();

    expect(await storage.getRefreshToken()).toBe("refresh-1");
    expect(client.getSessionSnapshot()).toEqual({
      status: "authenticated",
      user,
    });
  });

  it("coalesces refresh and retries concurrent bearer requests once", async () => {
    const storage = createMemoryTokenStorage();
    let accessToken = "expired-access";
    let refreshes = 0;
    const fetch = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) {
          return json(200, {
            user,
            access_token: accessToken,
            refresh_token: "refresh-1",
          });
        }
        if (path.endsWith("/tokens/refresh")) {
          refreshes += 1;
          await Promise.resolve();
          accessToken = "fresh-access";
          return json(200, {
            access_token: accessToken,
            refresh_token: "refresh-2",
          });
        }
        const authorization = new Headers(init?.headers).get("Authorization");
        return authorization === "Bearer fresh-access"
          ? json(200, user)
          : json(401, { error: { code: "unauthorized" } });
      },
    );
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch,
    });
    await client.signInWithPassword("mobile@example.com", "password");

    await Promise.all([client.getCurrentUser(), client.getCurrentUser()]);

    expect(refreshes).toBe(1);
    expect(await storage.getRefreshToken()).toBe("refresh-2");
  });

  it("revokes remotely and always clears the local refresh token", async () => {
    const storage = createMemoryTokenStorage();
    await storage.setRefreshToken("refresh-1");
    const fetch = vi.fn(async () =>
      json(500, { error: { code: "internal_error" } }),
    );
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch,
    });

    await expect(client.signOut()).resolves.toBeUndefined();

    expect(await storage.getRefreshToken()).toBeNull();
    expect(client.getSessionSnapshot().status).toBe("anonymous");
  });

  it("does not delete a refresh token on a transient refresh failure", async () => {
    const storage = createMemoryTokenStorage();
    await storage.setRefreshToken("refresh-1");
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch: vi.fn(async () => {
        throw new TypeError("offline");
      }),
    });

    expect(await client.restore()).toBe(false);
    expect(await storage.getRefreshToken()).toBe("refresh-1");
  });

  it("does not restore a session after a refresh completes behind sign-out", async () => {
    const storage = createMemoryTokenStorage();
    let resolveRefresh!: (response: Response) => void;
    const pendingRefresh = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    const fetch = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) {
          return json(200, {
            user,
            access_token: "expired-access",
            refresh_token: "refresh-1",
          });
        }
        if (path.endsWith("/tokens/refresh")) return pendingRefresh;
        if (path.endsWith("/tokens/revoke")) return json(204);
        const authorization = new Headers(init?.headers).get("Authorization");
        return authorization === "Bearer fresh-access"
          ? json(200, user)
          : json(401, { error: { code: "unauthorized" } });
      },
    );
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch,
    });
    await client.signInWithPassword("mobile@example.com", "password");

    const request = client.getCurrentUser();
    await vi.waitFor(() => {
      expect(
        fetch.mock.calls.some(([url]) =>
          String(url).endsWith("/auth/api/v1/tokens/refresh"),
        ),
      ).toBe(true);
    });
    await client.signOut();
    resolveRefresh(
      json(200, {
        access_token: "fresh-access",
        refresh_token: "refresh-2",
      }),
    );

    await expect(request).rejects.toMatchObject({ status: 401 });
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it("does not restore a token read from storage behind sign-out", async () => {
    let resolveStoredToken!: (token: string | null) => void;
    const storedToken = new Promise<string | null>((resolve) => {
      resolveStoredToken = resolve;
    });
    let removed = false;
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: {
        async getRefreshToken() {
          return storedToken;
        },
        async setRefreshToken() {},
        async removeRefreshToken() {
          removed = true;
        },
      },
      fetch: vi.fn(async () => json(204)),
    });

    const restore = client.restore();
    const signOut = client.signOut();
    resolveStoredToken("refresh-1");

    await expect(restore).resolves.toBe(false);
    await expect(signOut).resolves.toBeUndefined();
    expect(removed).toBe(true);
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
  });

  it("does not apply a login response that completes behind sign-out", async () => {
    const storage = createMemoryTokenStorage();
    let resolveLogin!: (response: Response) => void;
    const loginResponse = new Promise<Response>((resolve) => {
      resolveLogin = resolve;
    });
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch: vi.fn(async (url: string | URL | Request) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) return loginResponse;
        return json(204);
      }),
    });

    const login = client.signInWithPassword("mobile@example.com", "password");
    await client.signOut();
    resolveLogin(
      json(200, {
        user,
        access_token: "access-1",
        refresh_token: "refresh-1",
      }),
    );

    await expect(login).resolves.toMatchObject({ user });
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it("does not apply a retried token response that completes behind sign-out", async () => {
    const storage = createMemoryTokenStorage();
    let resolveRetry!: (response: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    let switchAttempts = 0;
    const fetch = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) {
          return json(200, {
            user,
            access_token: "expired-access",
            refresh_token: "refresh-1",
          });
        }
        if (path.endsWith("/tokens/refresh")) {
          return json(200, {
            access_token: "fresh-access",
            refresh_token: "refresh-2",
          });
        }
        if (path.endsWith("/switch")) {
          switchAttempts += 1;
          return switchAttempts === 1
            ? json(401, { error: { code: "unauthorized" } })
            : retryResponse;
        }
        if (path.endsWith("/tokens/revoke")) return json(204);
        throw new Error(
          `unexpected request: ${String(url)} ${String(init?.method)}`,
        );
      },
    );
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch,
    });
    await client.signInWithPassword("mobile@example.com", "password");

    const switching = client.switchOrganization({
      organizationID: "00000000-0000-0000-0000-000000000002",
    });
    await vi.waitFor(() => expect(switchAttempts).toBe(2));
    await client.signOut();
    resolveRetry(
      json(200, {
        access_token: "switched-access",
        refresh_token: "switched-refresh",
      }),
    );

    await expect(switching).resolves.toMatchObject({
      access_token: "switched-access",
    });
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
    expect(await storage.getRefreshToken()).toBeNull();
  });

  it("does not delete a newer login queued ahead of sign-out cleanup", async () => {
    let storedToken: string | null = null;
    let blockWrites = false;
    let releaseWrite!: () => void;
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const blockedWrite = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    const storage = {
      async getRefreshToken() {
        return storedToken;
      },
      async setRefreshToken(token: string) {
        if (blockWrites) {
          markWriteStarted();
          await blockedWrite;
        }
        storedToken = token;
      },
      async removeRefreshToken() {
        storedToken = null;
      },
    };
    let loginCount = 0;
    let resolveRevoke!: (response: Response) => void;
    const revokeResponse = new Promise<Response>((resolve) => {
      resolveRevoke = resolve;
    });
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage,
      fetch: vi.fn(async (url: string | URL | Request) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) {
          loginCount += 1;
          return json(200, {
            user,
            access_token: `access-${loginCount}`,
            refresh_token: `refresh-${loginCount}`,
          });
        }
        if (path.endsWith("/tokens/refresh")) {
          return json(200, {
            access_token: "stale-refresh-access",
            refresh_token: "stale-refresh-token",
          });
        }
        if (path.endsWith("/tokens/revoke")) return revokeResponse;
        return json(401, { error: { code: "unauthorized" } });
      }),
    });
    await client.signInWithPassword("mobile@example.com", "password");
    blockWrites = true;

    const request = client.getCurrentUser();
    await writeStarted;
    const signOut = client.signOut();
    const newLogin = client.signInWithPassword(
      "mobile@example.com",
      "password",
    );
    resolveRevoke(json(204));
    await Promise.resolve();
    releaseWrite();

    await expect(request).rejects.toMatchObject({ status: 401 });
    await expect(signOut).resolves.toBeUndefined();
    await expect(newLogin).resolves.toMatchObject({
      refresh_token: "refresh-2",
    });
    expect(storedToken).toBe("refresh-2");
    expect(client.getSessionSnapshot()).toEqual({
      status: "authenticated",
      user,
    });
  });

  it("does not revoke a newer token returned by a delayed storage read", async () => {
    let resolveStoredToken!: (token: string | null) => void;
    const storedToken = new Promise<string | null>((resolve) => {
      resolveStoredToken = resolve;
    });
    let currentToken: string | null = null;
    const revoked: string[] = [];
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: {
        async getRefreshToken() {
          return storedToken;
        },
        async setRefreshToken(token) {
          currentToken = token;
        },
        async removeRefreshToken() {
          currentToken = null;
        },
      },
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (path.endsWith("/login")) {
          return json(200, {
            user,
            access_token: "new-access",
            refresh_token: "new-refresh",
          });
        }
        if (path.endsWith("/tokens/revoke")) {
          revoked.push(JSON.parse(String(init?.body)).refresh_token);
          return json(204);
        }
        throw new Error(`unexpected request: ${String(url)}`);
      }),
    });

    const signOut = client.signOut();
    await client.signInWithPassword("mobile@example.com", "password");
    resolveStoredToken("new-refresh");

    await expect(signOut).resolves.toBeUndefined();
    expect(revoked).toEqual([]);
    expect(currentToken).toBe("new-refresh");
    expect(client.getSessionSnapshot().status).toBe("authenticated");
  });

  it("becomes anonymous when secure storage cannot be read", async () => {
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: {
        async getRefreshToken() {
          throw new Error("secure storage unavailable");
        },
        async setRefreshToken() {},
        async removeRefreshToken() {},
      },
      fetch: vi.fn(),
    });

    await expect(client.restore()).resolves.toBe(false);
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
  });

  it("does not publish an authenticated session when storage fails", async () => {
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: {
        async getRefreshToken() {
          return null;
        },
        async setRefreshToken() {
          throw new Error("secure storage unavailable");
        },
        async removeRefreshToken() {},
      },
      fetch: vi.fn(async () =>
        json(200, {
          user,
          access_token: "access-1",
          refresh_token: "refresh-1",
        }),
      ),
    });

    await expect(
      client.signInWithPassword("mobile@example.com", "password"),
    ).rejects.toThrow("secure storage unavailable");
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
  });

  it("stays locally anonymous when stored-token deletion fails", async () => {
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: {
        async getRefreshToken() {
          return "refresh-1";
        },
        async setRefreshToken() {},
        async removeRefreshToken() {
          throw new Error("secure storage unavailable");
        },
      },
      fetch: vi.fn(async () => json(204)),
    });

    await expect(client.signOut()).rejects.toThrow(
      "secure storage unavailable",
    );
    expect(client.getSessionSnapshot()).toEqual({
      status: "anonymous",
      user: null,
    });
  });

  it("runs login, link, reauthentication, and recovery through a native provider", async () => {
    const requests: Array<{ path: string; body?: unknown }> = [];
    const session = {
      user,
      access_token: "access-1",
      refresh_token: "refresh-1",
    };
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: createMemoryTokenStorage(),
      providers: {
        google: {
          authorize: vi.fn(async () => ({ credential: "google-id-token" })),
        },
      },
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        requests.push({ path, body });
        if (path.endsWith("/oauth/google/options")) {
          return json(200, {
            client_id: "google-web-client",
            nonce: "nonce-1",
            challenge_id: "challenge-1",
          });
        }
        if (
          path.endsWith("/oauth/google") ||
          path.endsWith("/provider-links/recovery/link-1/google")
        ) {
          return json(200, session);
        }
        return json(204);
      }),
    });

    await expect(
      client.runNativeProviderAction("google", {
        action: "login",
        audience: "app",
      }),
    ).resolves.toMatchObject({ action: "login", provider: "google", session });
    await expect(
      client.runNativeProviderAction("google", { action: "link" }),
    ).resolves.toEqual({ action: "link", provider: "google" });
    await expect(
      client.runNativeProviderAction("google", {
        action: "reauthenticate",
        authenticationChallengeId: "recent-1",
      }),
    ).resolves.toEqual({ action: "reauthenticate", provider: "google" });
    await expect(
      client.runNativeProviderAction("google", {
        action: "recover",
        audience: "app",
        recoveryLinkId: "link-1",
      }),
    ).resolves.toMatchObject({
      action: "recover",
      provider: "google",
      session,
    });

    const mutations = requests.filter(
      ({ path }) => !path.endsWith("/oauth/google/options"),
    );
    expect(mutations.map(({ path }) => path)).toEqual([
      "/auth/api/v1/oauth/google",
      "/auth/api/v1/account/auth-methods/google",
      "/auth/api/v1/reauthenticate/google",
      "/auth/api/v1/provider-links/recovery/link-1/google",
    ]);
    expect(mutations[0]?.body).toEqual({
      credential: "google-id-token",
      nonce: "nonce-1",
      challenge_id: "challenge-1",
    });
    expect(mutations[2]?.body).toEqual({
      credential: "google-id-token",
      nonce: "nonce-1",
      challenge_id: "challenge-1",
      authentication_challenge_id: "recent-1",
    });
    expect(mutations[3]?.body).toEqual({
      credential: "google-id-token",
      nonce: "nonce-1",
      challenge_id: "challenge-1",
    });
  });

  it("builds the native Apple and Microsoft login proofs expected by Core", async () => {
    const bodies: Record<string, unknown> = {};
    const client = createAuthara({
      baseUrl: "https://auth.example.com",
      storage: createMemoryTokenStorage(),
      providers: {
        apple: { authorize: vi.fn(async () => ({ code: "apple-code" })) },
        microsoft: {
          authorize: vi.fn(async () => ({ credential: "microsoft-token" })),
        },
      },
      fetch: vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const path = new URL(String(url)).pathname;
        if (init?.body) bodies[path] = JSON.parse(String(init.body));
        if (path.endsWith("/oauth/apple/options")) {
          return json(200, {
            client_id: "apple-client",
            redirect_uri: "https://auth.example.com/apple",
            state: "apple-state",
            nonce: "apple-nonce",
            challenge_id: "apple-challenge",
          });
        }
        if (path.endsWith("/oauth/microsoft/options")) {
          return json(200, {
            client_id: "microsoft-client",
            authority: "https://login.microsoftonline.com/common",
            nonce: "microsoft-nonce",
            challenge_id: "microsoft-challenge",
          });
        }
        return json(200, {
          user,
          access_token: "access-1",
          refresh_token: "refresh-1",
        });
      }),
    });

    await client.signInWithApple();
    await client.signInWithMicrosoft();
    await client.runNativeProviderAction("apple", {
      action: "recover",
      audience: "app",
      recoveryLinkId: "apple-link",
    });
    await client.runNativeProviderAction("apple", { action: "link" });
    await client.runNativeProviderAction("apple", {
      action: "reauthenticate",
      authenticationChallengeId: "recent-apple",
    });
    await client.runNativeProviderAction("microsoft", {
      action: "recover",
      audience: "app",
      recoveryLinkId: "microsoft-link",
    });
    await client.runNativeProviderAction("microsoft", {
      action: "reauthenticate",
      authenticationChallengeId: "recent-microsoft",
    });

    expect(bodies["/auth/api/v1/oauth/apple"]).toEqual({
      code: "apple-code",
      state: "apple-state",
      challenge_id: "apple-challenge",
    });
    expect(bodies["/auth/api/v1/oauth/microsoft"]).toEqual({
      credential: "microsoft-token",
      nonce: "microsoft-nonce",
      challenge_id: "microsoft-challenge",
    });
    expect(
      bodies["/auth/api/v1/provider-links/recovery/apple-link/apple"],
    ).toEqual({
      code: "apple-code",
      state: "apple-state",
      challenge_id: "apple-challenge",
    });
    expect(bodies["/auth/api/v1/account/auth-methods/apple"]).toEqual({
      code: "apple-code",
      state: "apple-state",
      challenge_id: "apple-challenge",
    });
    expect(bodies["/auth/api/v1/reauthenticate/apple"]).toEqual({
      code: "apple-code",
      state: "apple-state",
      challenge_id: "apple-challenge",
      authentication_challenge_id: "recent-apple",
    });
    expect(
      bodies["/auth/api/v1/provider-links/recovery/microsoft-link/microsoft"],
    ).toEqual({
      credential: "microsoft-token",
      nonce: "microsoft-nonce",
      challenge_id: "microsoft-challenge",
    });
    expect(bodies["/auth/api/v1/reauthenticate/microsoft"]).toEqual({
      credential: "microsoft-token",
      nonce: "microsoft-nonce",
      challenge_id: "microsoft-challenge",
      authentication_challenge_id: "recent-microsoft",
    });
  });
});
