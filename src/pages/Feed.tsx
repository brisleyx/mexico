import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { resolveDisplayCents } from "../lib/campaign";
import { secondsUntilMidnightMX } from "../lib/money";
import { simulateCompletedStreak } from "../lib/streak";
import { CountUp } from "../components/CountUp";
import { Streak } from "../components/Streak";
import { StickySaldo } from "../components/StickySaldo";
import { WelcomeModal } from "../components/WelcomeModal";
import { useAppState } from "../context/AppStateContext";
import { appState } from "../lib/appState";
import { transitionTo } from "../lib/router";

function formatPts(n: number) {
  return `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} puntos`;
}

function range14Label() {
  const fmt = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City",
  });
  const end = new Date();
  const start = new Date(end.getTime() - 13 * 24 * 60 * 60 * 1000);
  return `• ${fmt.format(start)} - ${fmt.format(end)}`;
}

function Completado() {
  return <span className="btn-concluido">Completado</span>;
}

function StepCoin() {
  return (
    <div className="step-icon" aria-hidden="true">
      <span className="step-coin">P</span>
    </div>
  );
}

function AssistaTip({ children, align = "left" }: { children: string; align?: "left" | "right" }) {
  return (
    <div className={`assista${align === "right" ? " is-right" : ""}`}>
      <span className="assista-txt">{children}</span>
      <svg className="assista-tail" xmlns="http://www.w3.org/2000/svg" width="7" height="6" viewBox="0 0 7 6" fill="none" aria-hidden="true">
        <path d="M4.033 5.25c-.385.667-1.347.667-1.732 0L.135 1.5C-.25.833.232 0 1.002 0h4.33c.77 0 1.251.833.866 1.5L4.033 5.25Z" fill="#F1F1F1" />
      </svg>
    </div>
  );
}

export function Feed() {
  const { balance, setBalance, currentStep } = useAppState();
  const saldoRef = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(secondsUntilMidnightMX);
  const [welcome, setWelcome] = useState(false);
  const [walletReady, setWalletReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .wallet()
      .then((wallet) => {
        if (cancelled) return;
        setBalance(resolveDisplayCents(wallet.balanceCents));
        setWalletReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        if (appState.get().balance <= 0) setBalance(resolveDisplayCents());
        setWalletReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [setBalance]);

  useEffect(() => {
    if (currentStep !== "one" || !walletReady) return;
    if (sessionStorage.getItem("lamantra.welcome")) return;
    const t = setTimeout(() => setWelcome(true), 350);
    return () => clearTimeout(t);
  }, [currentStep, walletReady]);

  useEffect(() => {
    const id = setInterval(() => setSecondsLeft(secondsUntilMidnightMX()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const el = saldoRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setSticky(!entry.isIntersecting), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const streak = simulateCompletedStreak(6);

  return (
    <section>
      <div className="saldo" ref={saldoRef}>
        <div className="container-saldo">
          <div className="saldo-info">
            <div className="saldo-label">
              <span>Tu saldo</span>
              <span className="p-saldo" aria-hidden="true">
                P
              </span>
            </div>
            <div className="valor-currency">
              <CountUp cents={balance} />
            </div>
          </div>
          <button type="button" className="btn btn-sacar" onClick={() => transitionTo("loading")}>
            Retirar
          </button>
        </div>
      </div>

      <div className="bloco">
        <div className="parabens">
          <div className="parabens-txt">
            <span className="parabens-txtum">¡Enhorabuena!</span>
            <span className="parabens-txtdois">
              Has completado <span className="nobreak">todas las tareas</span>
            </span>
            <span className="parabens-valor">
              <CountUp cents={balance} />
            </span>
          </div>
          <img className="parabens-img" src="/parabens-img.png" alt="" />
        </div>

        <div className="line" />

        <div className="entre">
          <div className="entre-txt">
            Entra durante 14 días para ganar
            <span className="entre-pts">{formatPts(8414)}</span>
            <span className="entre-data">{range14Label()}</span>
          </div>
          <Completado />
        </div>
        <div className="concluiu">
          <span className="concluiu-txt">Has completado todos los días de registro.</span>
        </div>
        <div className="streak-wrap">
          <Streak days={streak} />
        </div>

        <div className="line line-dois" />

        <div className="entre">
          <div className="entre-txt entre-txt-dois">
            Mira anuncios segmentados a diario para ganar hasta <span className="entre-pts">{formatPts(2730)}</span>
            <span className="entre-data">• 30/30 anuncios vistos</span>
          </div>
          <Completado />
        </div>

        <div className="line line-dois" />

        <div className="entre">
          <div className="entre-txt entre-txt-dois">
            Ver vídeos <span className="entre-pts">{formatPts(500)}</span>
          </div>
          <Completado />
        </div>
        <div className="mission-track">
          <AssistaTip>Mira durante 10 min</AssistaTip>
          <div className="progress-bar" aria-hidden="true">
            {["50 puntos", "100 puntos", "150 puntos", "225 puntos"].map((label) => (
              <div className="progress-step" key={label}>
                <StepCoin />
                <span className="step-text">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="line line-dois" />

        <div className="entre">
          <div className="entre-txt entre-txt-dois">
            Canjea tus recompensas y gana <span className="entre-pts">{formatPts(640)}</span>
            <span className="entre-data">• 8/8 canjeados</span>
          </div>
          <Completado />
        </div>

        <div className="line line-dois" />

        <div className="entre">
          <div className="entre-txt entre-txt-dois">
            Haz 60 búsquedas diarias para ganar hasta <span className="entre-pts">{formatPts(996)}</span>
            <span className="entre-data">• 60 búsquedas hechas hoy</span>
          </div>
          <Completado />
        </div>
        <div className="mission-track">
          <AssistaTip align="right">Hasta 756 puntos</AssistaTip>
          <div className="progress-bar" aria-hidden="true">
            <div className="progress-step is-hidden">
              <StepCoin />
              <span className="step-text">16 búsquedas</span>
            </div>
            <div className="progress-step">
              <StepCoin />
              <span className="step-text">36 búsquedas</span>
            </div>
            <div className="progress-step">
              <StepCoin />
              <span className="step-text">60 búsquedas</span>
            </div>
          </div>
        </div>
        <p className="obtem-txt">
          Obtén 21 puntos por escribir una consulta en la barra de búsqueda, o 0 puntos por tocar una búsqueda sugerida, como en “Puede que te guste”.
        </p>

        <div className="line line-dois" />

        <div className="entre entre-invite">
          <div className="entre-txt">
            Invita a 1 amigo para que se registre y gana
            <span className="entre-pts">100.000 puntos - 200.000 puntos</span>
          </div>
          <Completado />
        </div>
      </div>

      <StickySaldo visible={sticky} cents={balance} secondsLeft={secondsLeft} />
      <WelcomeModal
        open={welcome && currentStep === "one"}
        cents={balance}
        onClose={() => {
          sessionStorage.setItem("lamantra.welcome", "1");
          setWelcome(false);
        }}
      />
    </section>
  );
}
