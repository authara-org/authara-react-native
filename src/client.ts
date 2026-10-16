import type {
  AccountRecoveryLink,
  AuthUser,
  Tokens,
} from "./generated/types.js";
import type { AutharaTokenStorage } from "./storage.js";

type QueryValue = string | number | boolean | Array<string | number | boolean>;
export type AutharaAudience = "app" | "admin" | "operator";
export type AutharaSessionStatus = "loading" | "authenticated" | "anonymous";

export interface AutharaSessionSnapshot {
  status: AutharaSessionStatus;
  user: AuthUser | null;
}

export interface AutharaErrorDetails {
  error?: { code?: string; message?: string };
  authentication_challenge?: { id: string; expires_at: string };
  reauthenticate_url?: string;
  recovery?: AccountRecoveryLink;
}

export interface AutharaClientOptions {
  baseUrl: string;
  storage: AutharaTokenStorage;
  audience?: AutharaAudience;
  fetch?: typeof globalThis.fetch;
}

export class AutharaApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: AutharaErrorDetails;

  constructor(status: number, details?: AutharaErrorDetails) {
    super(details?.error?.message ?? `Authara request failed (${status})`);
    this.name = "AutharaApiError";
    this.status = status;
    this.code = details?.error?.code;
    this.details = details;
  }
}

export class AutharaClient {
  private readonly baseUrl: string;
  private readonly storage: AutharaTokenStorage;
  private readonly audience: AutharaAudience;
  private readonly fetchImpl: typeof globalThis.fetch;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private refreshPromise?: Promise<boolean>;
  private snapshot: AutharaSessionSnapshot = { status: "loading", user: null };
  private readonly listeners = new Set<() => void>();

  constructor(options: AutharaClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.storage = options.storage;
    this.audience = options.audience ?? "app";
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (!fetchImpl) throw new Error("Authara requires a fetch implementation");
    this.fetchImpl = fetchImpl;
  }

  getSessionSnapshot = (): AutharaSessionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected setCurrentUser(user: AuthUser | null): void {
    this.updateSnapshot({
      status: this.refreshToken ? "authenticated" : "anonymous",
      user,
    });
  }

  protected async restoreTokens(): Promise<boolean> {
    this.refreshToken = await this.storage.getRefreshToken();
    if (!this.refreshToken) {
      this.updateSnapshot({ status: "anonymous", user: null });
      return false;
    }
    const restored = await this.refresh();
    if (!restored && this.snapshot.status === "loading") {
      this.updateSnapshot({ status: "anonymous", user: null });
    }
    return restored;
  }

  async signOut(): Promise<void> {
    const refreshToken =
      this.refreshToken ?? (await this.storage.getRefreshToken());
    try {
      if (refreshToken) {
        await this.rawRequest("POST", "/auth/api/v1/tokens/revoke", {
          body: { refresh_token: refreshToken },
        });
      }
    } catch {
      // Local sign-out must still complete while offline.
    } finally {
      await this.clearSession();
    }
  }

  protected async request<T>(
    method: string,
    path: string,
    options: {
      query?: Record<string, QueryValue | undefined>;
      body?: unknown;
      csrf?: boolean;
      authenticated?: boolean;
    } = {},
  ): Promise<T> {
    const query = { ...options.query };
    if (options.csrf && !options.authenticated)
      query.session_transport = "token";
    let response = await this.rawRequest(method, path, {
      ...options,
      query,
      accessToken: options.authenticated ? this.accessToken : null,
    });

    if (
      response.status === 401 &&
      options.authenticated &&
      (await this.refresh())
    ) {
      response = await this.rawRequest(method, path, {
        ...options,
        query,
        accessToken: this.accessToken,
      });
    }

    const payload = await this.readJSON(response);
    if (!response.ok) throw new AutharaApiError(response.status, payload);
    if (response.status === 204) return undefined as T;
    await this.captureTokens(payload);
    return payload as T;
  }

  private async rawRequest(
    method: string,
    path: string,
    options: {
      query?: Record<string, QueryValue | undefined>;
      body?: unknown;
      accessToken?: string | null;
    } = {},
  ): Promise<Response> {
    const query = new URLSearchParams();
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) query.append(name, String(item));
      } else {
        query.set(name, String(value));
      }
    }
    const queryString = query.toString();
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ""}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined)
      headers["Content-Type"] = "application/json";
    if (options.accessToken)
      headers.Authorization = `Bearer ${options.accessToken}`;
    return this.fetchImpl(url, {
      method,
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  }

  private async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh().finally(() => {
        this.refreshPromise = undefined;
      });
    }
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<boolean> {
    let response: Response;
    try {
      response = await this.rawRequest("POST", "/auth/api/v1/tokens/refresh", {
        body: { refresh_token: this.refreshToken, audience: this.audience },
      });
    } catch {
      return false;
    }
    if (response.status === 401) {
      await this.clearSession();
      return false;
    }
    if (!response.ok) return false;
    const tokens = (await this.readJSON(response)) as Tokens | undefined;
    if (!tokens?.access_token || !tokens.refresh_token) return false;
    await this.setTokens(tokens.access_token, tokens.refresh_token);
    return true;
  }

  private async captureTokens(payload: unknown): Promise<void> {
    if (!payload || typeof payload !== "object") return;
    const candidate = payload as Partial<Tokens> & { user?: AuthUser };
    if (!candidate.access_token || !candidate.refresh_token) return;
    await this.setTokens(candidate.access_token, candidate.refresh_token);
    if (candidate.user) this.setCurrentUser(candidate.user);
  }

  private async setTokens(
    accessToken: string,
    refreshToken: string,
  ): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    await this.storage.setRefreshToken(refreshToken);
    this.updateSnapshot({ status: "authenticated", user: this.snapshot.user });
  }

  private async clearSession(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    await this.storage.removeRefreshToken();
    this.updateSnapshot({ status: "anonymous", user: null });
  }

  private updateSnapshot(snapshot: AutharaSessionSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }

  private async readJSON(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}
