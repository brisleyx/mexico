import { useEffect, useState } from "react";
import { CountUp } from "../components/CountUp";
import { SetupVideoModal } from "../components/SetupVideoModal";
import { useAppState } from "../context/AppStateContext";
import { getCampaignRewardCents } from "../lib/campaign";
import { formatHms, formatMxn } from "../lib/money";
import { transitionTo } from "../lib/router";
import { MIN_WITHDRAWAL_CENTS } from "../lib/types";

const TIMER_START_SECONDS = 16 * 60 + 38;
const CHIP_CENTS = [MIN_WITHDRAWAL_CENTS, 4_000, 8_000] as const;
const POINTS_PER_MXN = 20_320;

function formatPoints(cents: number) {
  const pts = Math.round((cents / 100) * POINTS_PER_MXN);
  return `= ${pts.toLocaleString("es-MX")} puntos`;
}

export function Checkout() {
  const { balance, setLastWithdrawal } = useAppState();
  const displayCents = balance > 0 ? balance : getCampaignRewardCents();
  const lastRewardCents = displayCents;
  const [secondsLeft, setSecondsLeft] = useState(TIMER_START_SECONDS);
  const [selected, setSelected] = useState<number | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const unlocked = selected !== null;
  const expired = secondsLeft < 0;

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  function withdraw() {
    if (!unlocked || selected === null) return;
    setLastWithdrawal(selected);
    setTutorialOpen(true);
  }

  function continueTutorial() {
    setTutorialOpen(false);
    transitionTo("five");
  }

  return (
    <>
      <div className="expira-saldo">
        <div className="timer-wrapper">
          {expired ? (
            <p id="countdown-text">TU SALDO HA EXPIRADO</p>
          ) : (
            <p id="countdown-text">
              TU SALDO EXPIRA EN
              <span id="timer">{formatHms(Math.max(0, secondsLeft))}</span>
            </p>
          )}
        </div>
      </div>
      <div className="title">Canjear recompensas</div>
      <div className="saldo-ticket">
        <div className="saldo saldo-dois">
          <div className="container-saldo" role="region" aria-labelledby="saldo-title">
            <div className="saldo-info saldo-info-dois">
              <div className="saldo-label">
                <span className="saldo-text saldo-text-dois">Tu saldo</span>
              </div>

              <div className="saldo-valor saldo-valor-dois" aria-live="polite">
                <span className="valor-currency valor-currency-dois" data-amount-target={(displayCents / 100).toFixed(2)}>
                  <CountUp cents={displayCents} />
                </span>
                <span className="total-pontos">{formatPoints(displayCents)}</span>
              </div>
            </div>

            <div className="saldo-action">
              <span className="saldo-img">
                <img src="/images/p-saldo-maior.svg" alt="" className="p-saldo p-saldo-maior" />
              </span>
            </div>
          </div>
        </div>
        <div className="linha" />
        <div className="saldo saldo-tres">
          <div className="container-saldo" role="region" aria-labelledby="saldo-title">
            <div className="saldo-info saldo-info-dois">
              <div className="saldo-valor saldo-valor-dois" aria-live="polite">
                <span className="total-pontos total-pontos-dois">Última recompensa: {formatMxn(lastRewardCents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="saldo saldo-sacar">
        <div className="container-saldo" role="region" aria-labelledby="saldo-title">
          <div className="saldo-info saldo-info-sacar">
            <div className="saldo-label">
              <span className="saldo-sacar-text">Retirar dinero</span>
            </div>

            <div className="saldo-valor" aria-live="polite">
              <span className="transferencia-txt">
                <img src="/images/bank-transfer.svg" alt="" style={{ width: 20, verticalAlign: "middle", marginRight: 4 }} />
                Transferencia vía /
                <img src="/images/bbva-logo.jpg" alt="BBVA" className="bbva-logo-transf" />
              </span>
            </div>
          </div>
        </div>
        <div className="widget-container">
          <div className="botoes-row botoes-row-sacar">
            {CHIP_CENTS.map((cents) => (
              <button
                key={cents}
                type="button"
                className={`btn-valor${selected === cents ? " btn-active" : ""}`}
                onClick={() => setSelected(cents)}
              >
                {formatMxn(cents)}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`btn-valor display-total${selected === displayCents ? " btn-active" : ""}`}
            onClick={() => setSelected(displayCents)}
          >
            {formatMxn(displayCents)}
          </button>
        </div>
        <button
          type="button"
          className={`btn-obrigado btn-sacar-dois${unlocked ? "" : " btn-sacar-indisponivel"}`}
          aria-label="retirar dinero"
          onClick={withdraw}
        >
          <span className="btn-text btn-textdois-sacar btn-three-saque">Retirar dinero</span>
        </button>
        <div className="obtem obtem-sacar sacar-dinheiro">
          <span className="obtem-txt">
            Para retirar dinero, necesitas un saldo mínimo de {formatMxn(MIN_WITHDRAWAL_CENTS)}. Los límites de retirada para transacciones individuales y mensuales pueden variar según el país o región.
          </span>
        </div>
      </div>

      <div className="saldo saldo-sacar">
        <div className="container-saldo ctn-flor" role="region" aria-labelledby="saldo-title">
          <img src="/images/flor.png" alt="" className="flor" />
          <div className="saldo-info obtenha-title">
            <div className="saldo-label">
              <span className="saldo-sacar-text obtenha-txt">Obtén Monedas para el LIVE</span>
            </div>

            <div className="saldo-valor saldo-valor-tres border-none" aria-live="polite">
              <span className="transferencia-txt monedas-txt">
                Usa Monedas para enviar regalos virtuales a tus creadores favoritos en directo.
              </span>
            </div>
          </div>
        </div>

        <button type="button" className="btn-sacar-indisponivel" aria-label="retirar dinero">
          <span className="btn-text btn-indis">No disponible</span>
        </button>
      </div>

      <div className="saldo saldo-sacar">
        <div className="container-saldo" role="region" aria-labelledby="saldo-title">
          <div className="saldo-info obtenha-title">
            <div className="saldo-label">
              <span className="saldo-sacar-text obtenha-txt">Recarga móvil</span>
            </div>

            <div className="saldo-valor saldo-valor-tres celular-recarga" aria-live="polite">
              <span className="ddd">+52</span>
              <span className="linha-ddd" />
              <div className="telefone">55 1234 5678</div>
            </div>
          </div>
        </div>

        <button type="button" className="btn-sacar-indisponivel" aria-label="retirar dinero">
          <span className="btn-text btn-indis">No disponible</span>
        </button>
        <div className="obtem obtem-sacar">
          <span className="obtem-txt recarga-txt">Necesitas un saldo mínimo de {formatMxn(MIN_WITHDRAWAL_CENTS)} para recarga de celular</span>
        </div>
      </div>

      <footer className="checkout-footer">
        <div className="checkout-footer-refund">
          <svg className="checkout-footer-clock" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="#7C3AED" />
            <circle cx="8" cy="8" r="5.1" fill="#fff" />
            <path d="M8 4.6v3.2l2.1 1.3" fill="none" stroke="#7C3AED" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          Reembolso automático en 1 minuto
        </div>
        <div className="checkout-footer-text">Proceso 100% seguro</div>
        <span className="checkout-footer-link">¿Necesitas ayuda?</span>
      </footer>
      <SetupVideoModal open={tutorialOpen} onContinue={continueTutorial} />
    </>
  );
}
