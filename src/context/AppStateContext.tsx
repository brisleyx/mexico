import { createContext, useContext, useLayoutEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { appState, type AppState, type StepId, type UserData } from "../lib/appState";
import { bindNavigate, transitionTo } from "../lib/router";

type AppStateContextValue = AppState & {
  setBalance: (balance: number) => void;
  setLastWithdrawal: (cents: number) => void;
  patchUserData: (patch: Partial<UserData>) => void;
  transitionTo: (stepId: StepId) => void;
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    (onChange) => appState.subscribe(() => onChange()),
    appState.get,
    appState.get,
  );

  const value = useMemo<AppStateContextValue>(
    () => ({
      ...snapshot,
      setBalance: appState.setBalance,
      setLastWithdrawal: appState.setLastWithdrawal,
      patchUserData: appState.patchUserData,
      transitionTo: (stepId: StepId) => transitionTo(stepId),
    }),
    [snapshot],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function RouterBridge() {
  const navigate = useNavigate();

  useLayoutEffect(() => {
    bindNavigate((to, options) => navigate(to, options));
    return () => bindNavigate(null);
  }, [navigate]);

  return null;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState fuera de AppStateProvider");
  return ctx;
}
