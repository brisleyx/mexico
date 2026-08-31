import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "../components/Logo";
import { useAuth } from "../context/AuthContext";
import { DAILY_CAP_CENTS, MIN_WITHDRAWAL_CENTS } from "../lib/types";
import { formatMxn } from "../lib/money";
import { transitionTo } from "../lib/router";

const STATS = [
  { label: "Campañas de socios activas", target: 4, note: "Revisando catálogo de marcas…" },
  { label: "Tope diario en MXN", target: DAILY_CAP_CENTS / 100, note: "Calculando límite del día…" },
  { label: "Retiro mínimo SPEI", target: MIN_WITHDRAWAL_CENTS / 100, note: "Listo. Crea tu cuenta para empezar." },
];

export function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const continueTimer = useRef(0);
  const [progress, setProgress] = useState([0, 0, 0]);
  const [note, setNote] = useState("Preparando LaMantra…");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];
    const delay = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(window.setTimeout(resolve, ms));
      });
    const easeOut = (t: number) => 1 - (1 - t) ** 3;
    const fillBar = (index: number, duration: number) =>
      new Promise<void>((resolve) => {
        const start = performance.now();
        const tick = (now: number) => {
          if (cancelled) return;
          const t = Math.min(1, (now - start) / duration);
          const eased = easeOut(t);
          setProgress((prev) => {
            if (Math.abs(prev[index] - eased) < 0.0005) return prev;
            const next = [...prev];
            next[index] = eased;
            return next;
          });
          if (t < 1) {
            raf = requestAnimationFrame(tick);
            return;
          }
          setProgress((prev) => {
            if (prev[index] === 1) return prev;
            const next = [...prev];
            next[index] = 1;
            return next;
          });
          resolve();
        };
        raf = requestAnimationFrame(tick);
      });
    const run = async () => {
      for (let i = 0; i < STATS.length; i++) {
        if (cancelled) return;
        setNote(STATS[i].note);
        await fillBar(i, 2200);
        await delay(180);
      }
      if (!cancelled) {
        setNote("Tu uso en LaMantra empieza en cero. Pulsa para continuar.");
        setReady(true);
      }
    };
    run();
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

  function continueOn() {
    setLoading(true);
    continueTimer.current = window.setTimeout(() => {
      sessionStorage.removeItem("lamantra.welcome");
      if (user) transitionTo("one");
      else navigate("/registro");
    }, 1200);
  }

  return (
    <div className="presell">
      <canvas ref={canvasRef} className="presell-canvas" />
      <div className="presell-card">
        <Logo />
        <h1>
          Cumples el perfil para ver socios y
          <span> cobrar en pesos.</span>
        </h1>
        <p className="subtitle">
          LaMantra acredita solo lo que viste. Revisa el resumen y entra a tu cuenta para empezar en $0.00.
        </p>
        <div className="stats-box">
          <div className="stats-title">
            <span className="stats-title-dot" />
            Detalles de LaMantra
          </div>
          {STATS.map((stat, i) => {
            const filled = progress[i];
            const shown = stat.target * filled;
            return (
              <div className="stat" key={stat.label}>
                <div className="stat-top">
                  <span className="stat-label">{stat.label}</span>
                  <span className={`stat-value ${filled >= 1 ? "is-done" : ""}`}>
                    {i === 0 ? `${Math.round(shown)}/${stat.target}` : formatMxn(shown * 100)}
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
        <button type="button" className={`btn claim-btn ${ready ? "" : "is-hidden"}`} onClick={continueOn} disabled={!ready}>
          {user ? "Entrar a mis videos" : "Crear mi cuenta"}
        </button>
        {!user ? (
          <p className="auth-foot">
            ¿Ya tienes cuenta? <Link to="/entrar">Entrar</Link>
          </p>
        ) : null}
        <p className="small-text">México · SPEI · marca LaMantra. El saldo no llega regalado: se gana viendo.</p>
      </div>
      {loading ? (
        <div className="lm-loader">
          <div className="lm-spin" />
          <p className="note">Abriendo tu espacio LaMantra…</p>
        </div>
      ) : null}
    </div>
  );
}
