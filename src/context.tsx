import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from "react";

import type { AutharaSessionSnapshot } from "./client.js";
import type { AutharaNativeClient } from "./native-client.js";

const AutharaContext = createContext<AutharaNativeClient | null>(null);

export interface AutharaProviderProps extends PropsWithChildren {
  client: AutharaNativeClient;
}

export function AutharaProvider({ client, children }: AutharaProviderProps) {
  useEffect(() => {
    void client.restore();
  }, [client]);
  return (
    <AutharaContext.Provider value={client}>{children}</AutharaContext.Provider>
  );
}

export interface UseAutharaResult extends AutharaSessionSnapshot {
  client: AutharaNativeClient;
  signOut(): Promise<void>;
}

export function useAuthara(): UseAutharaResult {
  const client = useContext(AutharaContext);
  if (!client)
    throw new Error("useAuthara must be used inside AutharaProvider");
  const snapshot = useSyncExternalStore(
    client.subscribe,
    client.getSessionSnapshot,
    client.getSessionSnapshot,
  );
  return useMemo(
    () => ({ ...snapshot, client, signOut: () => client.signOut() }),
    [client, snapshot],
  );
}
