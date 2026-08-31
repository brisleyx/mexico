import { useEffect, useRef, useState } from "react";
import { LoadingLogoSlot } from "../components/LoadingLogoSlot";
import { useAppState } from "../context/AppStateContext";
import { transitionTo } from "../lib/router";

const DURATION_MS = 60000;

const STAGES = [
  { until: 0.34, label: "Validando datos…" },
  { until: 0.67, label: "Sincronizando…" },
  { until: 1, label: "Finalizando…" },
] as const;

function stageFor(progress: number) {
  return STAGES.find((stage) => progress <= stage.until)?.label ?? STAGES[STAGES.length - 1].label;
}

export function LoadingScreen() {
  const { currentStep } = useAppState();
  const fillRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<string>(STAGES[0].label);
  const [status, setStatus] = useState<string>(STAGES[0].label);

  useEffect(() => {
    const fill = fillRef.current;
    const percent = percentRef.current;

    const resetVisual = () => {
      if (fill) {
        fill.style.width = "0%";
        fill.style.willChange = "auto";
      }
      if (percent) percent.textContent = "0%";
      statusRef.current = STAGES[0].label;
      setStatus(STAGES[0].label);
    };

    if (currentStep !== "loading") {
      resetVisual();
      return;
    }

    let frame = 0;
    let finished = false;
    const startedAt = performance.now();
    if (fill) fill.style.willChange = "width";

    const tick = (now: number) => {
      if (finished) return;
      const t = Math.min(1, (now - startedAt) / DURATION_MS);
      const pct = t * 100;

      if (fill) fill.style.width = `${pct}%`;
      if (percent) percent.textContent = `${Math.round(pct)}%`;

      const nextStatus = stageFor(t);
      if (nextStatus !== statusRef.current) {
        statusRef.current = nextStatus;
        setStatus(nextStatus);
      }

      if (t < 1) {
        frame = window.requestAnimationFrame(tick);
        return;
      }

      finished = true;
      if (fill) {
        fill.style.width = "100%";
        fill.style.willChange = "auto";
      }
      if (percent) percent.textContent = "100%";
      transitionTo("checkout");
    };

    frame = window.requestAnimationFrame(tick);

    return () => {
      finished = true;
      window.cancelAnimationFrame(frame);
      if (fill) fill.style.willChange = "auto";
    };
  }, [currentStep]);

  return (
    <div className="screen-loader" role="status" aria-live="polite" aria-busy={currentStep === "loading"}>
      <LoadingLogoSlot />
      <div className="loader-body">
        <div className="lm-spin" aria-hidden="true" />
        <p className="loader-status">{status}</p>
        <div className="loader-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-label="Progreso de la solicitud">
          <div ref={fillRef} className="progress-bar-fill" />
        </div>
        <span ref={percentRef} className="loader-percent">
          0%
        </span>
      </div>
    </div>
  );
}
