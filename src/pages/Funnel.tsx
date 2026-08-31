import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Screen } from "../components/Screen";
import { useAppState } from "../context/AppStateContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { appState } from "../lib/appState";
import { applyScreen, stepFromLocation } from "../lib/router";
import { Landing } from "./Landing";
import { Feed } from "./Feed";
import { LoadingScreen } from "./Loading";
import { Checkout } from "./Checkout";
import { Setup } from "./Setup";
import { PaymentGateway } from "./PaymentGateway";
import { SuccessScreen } from "./Success";

export function Funnel() {
  const { user } = useAuth();
  const { currentStep, setBalance } = useAppState();
  const location = useLocation();
  const loggedIn = Boolean(user);
  const inApp = location.pathname.startsWith("/app");
  const withdrawContinuation = ["five", "payment-gateway", "success"].includes(currentStep);

  useLayoutEffect(() => {
    const fromPath = stepFromLocation(location.pathname, location.hash);
    if (fromPath && fromPath !== appState.get().currentStep) {
      appState.setStep(fromPath);
    }
    applyScreen(fromPath ?? appState.get().currentStep);
  }, [location.pathname, location.hash, currentStep, loggedIn]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const syncBalance = () => {
      api
        .wallet()
        .then((wallet) => {
          if (!cancelled) setBalance(wallet.balanceCents);
        })
        .catch(() => {});
    };
    syncBalance();
    window.addEventListener("lamantra:wallet", syncBalance);
    return () => {
      cancelled = true;
      window.removeEventListener("lamantra:wallet", syncBalance);
    };
  }, [user, setBalance]);

  useEffect(() => {
    if (!withdrawContinuation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [withdrawContinuation]);

  const screens = (
    <div id="screens" className={withdrawContinuation ? "is-withdraw-continuation" : undefined}>
      <Screen id="presell">
        <Landing />
      </Screen>
      <Screen id="one">
        <Feed />
      </Screen>
      <Screen id="loading">
        <LoadingScreen />
      </Screen>
      <Screen id="checkout" keepMounted={withdrawContinuation}>
        <Checkout />
      </Screen>
      <Screen id="five">
        <Setup />
      </Screen>
      <Screen id="payment-gateway">
        <PaymentGateway />
      </Screen>
      <Screen id="success">
        <SuccessScreen />
      </Screen>
    </div>
  );

  if (inApp) {
    return <AppShell>{screens}</AppShell>;
  }

  return screens;
}
