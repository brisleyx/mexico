import type { ReactNode } from "react";
import { useAppState } from "../context/AppStateContext";
import type { StepId } from "../lib/appState";

export function Screen({
  id,
  children,
  keepMounted = false,
}: {
  id: StepId;
  children: ReactNode;
  keepMounted?: boolean;
}) {
  const { currentStep } = useAppState();
  const active = currentStep === id;

  return (
    <section id={id} className={active ? "screen is-active" : "screen"} aria-hidden={active ? undefined : true}>
      {active || keepMounted ? children : null}
    </section>
  );
}
