import { useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { SyncLoader } from "../components/SyncLoader";
import { useAuth } from "../context/AuthContext";
import { transitionTo } from "../lib/router";

const STATS = [
  { label: "Vídeos vistos", target: 50, note: "Analizando tus vídeos vistos…" },
  { label: "Tiempo de uso en la plataforma", target: 1000, note: "Comprobando tu tiempo activo en la plataforma…" },
  { label: "Vídeos que te han gustado", target: 100, note: "Verificando tus interacciones (likes)…" },
];

function countStep(target: number) {
  if (target > 600) return 40;
  if (target > 200) return 20;
  return 1;
}

export function Landing() {
  const { ensureSession } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const continueTimer = useRef(0);
  const [counts, setCounts] = useState([0, 0, 0]);
  const [note, setNote] = useState("Analizando tus vídeos vistos…");
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];

    const animateStat = (index: number) => {
      if (cancelled || index >= STATS.length) return;
      const target = STATS[index].target;
      const step = countStep(target);
      const duration = (target / step) * 40;
      const start = performance.now();
      setNote(STATS[index].note);

      const tick = (now: number) => {
        if (cancelled) return;
        const current = Math.min(target, Math.floor(((now - start) / duration) * target));
        const snapped = Math.min(target, Math.floor(current / step) * step);
        setCounts((prev) => {
          if (prev[index] === snapped) return prev;
          const next = [...prev];
          next[index] = snapped;
          return next;
        });
        if (snapped < target) {
          raf = requestAnimationFrame(tick);
          return;
        }
        setCounts((prev) => {
          if (prev[index] === target) return prev;
          const next = [...prev];
          next[index] = target;
          return next;
        });
        if (index < STATS.length - 1) {
          timers.push(window.setTimeout(() => animateStat(index + 1), 400));
          return;
        }
        setNote("¡Listo! Tu uso ha sido validado. Pulsa para liberar el progreso.");
        setReady(true);
      };

      raf = requestAnimationFrame(tick);
    };

    animateStat(0);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const particles = Array.from({ length: 36 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 1.2 + Math.random() * 2.2,
      vy: 0.15 + Math.random() * 0.35,
      vx: (Math.random() - 0.5) * 0.2,
      a: 0.25 + Math.random() * 0.35,
      c: Math.random() > 0.5 ? "254,43,84" : "56,189,248",
    }));
    const size = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio;
      canvas.height = canvas.clientHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.y += p.vy / 80;
        p.x += p.vx / 80;
        if (p.y > 1) p.y = 0;
        if (p.x < 0) p.x = 1;
        if (p.x > 1) p.x = 0;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c},${p.a})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(continueTimer.current);
  }, []);

  async function continueOn() {
    if (syncing) return;
    setSyncing(true);
    const started = performance.now();
    const wait = 1500 + Math.random() * 1000;
    try {
      await ensureSession();
    } catch {
      /* the overlay is simulated identity check; still continue into the funnel */
    }
    const remaining = Math.max(0, wait - (performance.now() - started));
    continueTimer.current = window.setTimeout(() => {
      sessionStorage.removeItem("lamantra.welcome");
      transitionTo("one");
    }, remaining);
  }

  return (
    <div className="presell">
      <canvas ref={canvasRef} className="presell-canvas" />
      <div className="presell-card">
        <Logo />
        <h1>
          Has cumplido con todos los
          <span> criterios de actividad.</span>
        </h1>
        <p className="subtitle">
          Confirmamos que tu cuenta ha cumplido con los requisitos mínimos de uso. Revisa el resumen a continuación y pulsa para liberar tu progreso.
        </p>
        <div className="stats-box">
          <div className="stats-title">
            <span className="stats-title-dot" />
            Detalles de tu actividad
          </div>
          {STATS.map((stat, i) => {
            const shown = counts[i];
            const filled = shown / stat.target;
            return (
              <div className="stat" key={stat.label}>
                <div className="stat-top">
                  <span className="stat-label">{stat.label}</span>
                  <span className={`stat-value ${filled >= 1 ? "is-done" : ""}`}>
                    {shown}/{stat.target}
                  </span>
                </div>
                <div className="bar">
                  <div className="bar-fill" style={{ transform: `scaleX(${filled})` }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="note">{note}</p>
        <button
          type="button"
          id="claimBtn"
          className={`btn claim-btn ${ready ? "" : "is-hidden"}`}
          onClick={continueOn}
          disabled={!ready || syncing}
        >
          <span className="btn-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
              <path d="M5.5 9.511c.076.954.83 1.697 2.182 1.785V12h.6v-.709c1.4-.098 2.218-.846 2.218-1.932 0-.987-.626-1.496-1.745-1.76l-.473-.112V5.57c.6.068.982.396 1.074.85h1.052c-.076-.919-.864-1.638-2.126-1.716V4h-.6v.719c-1.195.117-2.01.836-2.01 1.853 0 .9.606 1.472 1.613 1.707l.397.098v2.034c-.615-.093-1.022-.43-1.114-.9zm2.177-2.166c-.59-.137-.91-.416-.91-.836 0-.47.345-.822.915-.925v1.76h-.005zm.692 1.193c.717.166 1.048.435 1.048.91 0 .542-.412.914-1.135.982V8.518z" />
              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
              <path d="M8 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11m0 .5A6 6 0 1 0 8 2a6 6 0 0 0 0 12" />
            </svg>
          </span>
          Liberar mi progreso
        </button>
        <p className="small-text">
          Los datos anteriores se generan automáticamente en función de tu interacción reciente en la plataforma.
        </p>
      </div>
      <SyncLoader open={syncing} />
    </div>
  );
}
