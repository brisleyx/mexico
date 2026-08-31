import { useEffect, useState } from "react";
import { SetupVideoModal } from "../components/SetupVideoModal";
import { useAppState } from "../context/AppStateContext";
import { formatHms } from "../lib/money";
import { transitionTo } from "../lib/router";

const TIMER_START_SECONDS = 16 * 60 + 38;
const AMOUNTS = [
  { label: "1,5 €", euros: 1.5 },
  { label: "5 €", euros: 5 },
  { label: "10 €", euros: 10 },
] as const;

function formatEur(amount: number) {
  const [int, dec] = amount.toFixed(2).split(".");
  return `${int},${dec} €`;
}

export function Checkout() {
  const { setLastWithdrawal } = useAppState();
  const displayEuros = 1395;
  const [secondsLeft, setSecondsLeft] = useState(TIMER_START_SECONDS);
  const [shownEuros, setShownEuros] = useState(0);
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

  useEffect(() => {
    const from = 0;
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) * (1 - t);
      setShownEuros(from + (displayEuros - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [displayEuros]);

  function withdraw() {
    if (!unlocked || selected === null) return;
    setLastWithdrawal(Math.round(selected * 100));
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
                <span className="valor-currency valor-currency-dois" data-amount-target="1395.00">
                  {formatEur(shownEuros)}
                </span>
                <span className="total-pontos">= 28.347.200 pontos (s)</span>
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
                <span className="total-pontos total-pontos-dois">Última recompensa: 646,43 €</span>
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
                <img src="/images/bbva-logo.png" alt="BBVA" className="bbva-logo-transf" />
              </span>
            </div>
          </div>
        </div>
        <div className="widget-container">
          <div className="botoes-row botoes-row-sacar">
            {AMOUNTS.map((amount) => (
              <button
                key={amount.label}
                type="button"
                className={`btn-valor${selected === amount.euros ? " btn-active" : ""}`}
                onClick={() => setSelected(amount.euros)}
              >
                {amount.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`btn-valor display-total${selected === displayEuros ? " btn-active" : ""}`}
            onClick={() => setSelected(displayEuros)}
          >
            1395,00 €
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
            Para retirar dinero, necesitas un saldo mínimo de 1,5 €. Los límites de retirada para transacciones individuales y mensuales pueden variar según el país o región.
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
              <span className="ddd">+34</span>
              <span className="linha-ddd" />
              <div className="telefone">612 345 678</div>
            </div>
          </div>
        </div>

        <button type="button" className="btn-sacar-indisponivel" aria-label="retirar dinero">
          <span className="btn-text btn-indis">No disponible</span>
        </button>
        <div className="obtem obtem-sacar">
          <span className="obtem-txt recarga-txt">Necesitas un saldo mínimo de 10 € para recarga de celular</span>
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
