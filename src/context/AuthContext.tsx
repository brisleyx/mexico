import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import { localApi } from "../lib/localApi";
import { appState } from "../lib/appState";
import type { Profile } from "../lib/types";

type AuthState = {
  user: Profile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  ensureSession: () => Promise<Profile>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const session = await api.getSession();
    setUser(session);
  }, []);

  const ensureSession = useCallback(async () => {
    try {
      const session = await api.ensureSession();
      setUser(session);
      return session;
    } catch {
      const session = await localApi.ensureSession();
      const wallet = await localApi.wallet();
      appState.setBalance(wallet.balanceCents);
      setUser(session);
      return session;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getSession()
      .then((session) => {
        if (!cancelled) setUser(session);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      refresh,
      ensureSession,
      signOut: async () => {
        await api.signOut();
        setUser(null);
        appState.reset();
      },
    }),
    [user, loading, refresh, ensureSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth fuera de AuthProvider");
  return ctx;
}
