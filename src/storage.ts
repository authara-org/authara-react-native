export interface AutharaTokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  removeRefreshToken(): Promise<void>;
}

export function createMemoryTokenStorage(): AutharaTokenStorage {
  let refreshToken: string | null = null;
  return {
    async getRefreshToken() {
      return refreshToken;
    },
    async setRefreshToken(token) {
      refreshToken = token;
    },
    async removeRefreshToken() {
      refreshToken = null;
    },
  };
}
