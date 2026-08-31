import { appState, FLOW, isStepId, type StepId } from "./appState";

export const STEP_PATH: Record<StepId, string> = {
  presell: "/",
  one: "/app",
  loading: "/app/cargando",
  checkout: "/app/billetera",
  five: "/app/retiro",
  "payment-gateway": "/app/pago",
  success: "/app/exito",
};

type NavigateLike = (to: string, options?: { replace?: boolean }) => void;

let navigateFn: NavigateLike | null = null;

export function bindNavigate(fn: NavigateLike | null) {
  navigateFn = fn;
}

export function applyScreen(stepId: string) {
  const screens = document.querySelectorAll<HTMLElement>(".screen");
  if (!screens.length) return false;

  let found = false;
  screens.forEach((screen) => {
    const active = screen.id === stepId;
    screen.classList.toggle("is-active", active);
    if (active) {
      screen.removeAttribute("aria-hidden");
      found = true;
    } else {
      screen.setAttribute("aria-hidden", "true");
    }
  });

  if (!found) return false;

  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  return true;
}

type TransitionOptions = {
  push?: boolean;
  replace?: boolean;
};

export function transitionTo(stepId: string, options: TransitionOptions = {}) {
  if (!isStepId(stepId)) return;

  const { push = true, replace = false } = options;
  appState.setStep(stepId);
  applyScreen(stepId);

  const path = STEP_PATH[stepId];
  if (!push && !replace) return;

  if (navigateFn) {
    navigateFn(path, { replace: replace || !push });
    return;
  }

  try {
    const method = replace || !push ? "replaceState" : "pushState";
    history[method]({ screen: stepId }, "", path);
  } catch {
    location.hash = stepId;
  }
}

export function nextStep() {
  const index = FLOW.indexOf(appState.get().currentStep);
  const next = FLOW[index + 1];
  if (next) transitionTo(next);
}

export function stepFromLocation(pathname: string, hash = ""): StepId | null {
  const fromHash = hash.replace(/^#/, "");
  if (isStepId(fromHash)) return fromHash;
  const match = (Object.entries(STEP_PATH) as [StepId, string][]).find(([, path]) => path === pathname);
  return match ? match[0] : null;
}

/** Path to resume after login. Presell has no in-app screen yet, so it maps to home. */
export function resumePathAfterAuth(): string {
  const step = appState.get().currentStep;
  return STEP_PATH[step === "presell" ? "one" : step];
}
