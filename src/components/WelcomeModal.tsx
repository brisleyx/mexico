import { useEffect, useState } from "react";
import { BankCount } from "./BankCount";
import { CAMPAIGN_REWARD_CENTS } from "../lib/campaign";
import { secondsUntilMidnightMX } from "../lib/money";

export { CAMPAIGN_REWARD_CENTS };

/** Título en negrita encima de Enhorabuena. Cámbialo aquí. */
export const REWARD_TITLE = "Premios";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function splitHms(total: number) {
  const t = Math.max(0, total);
  return {
    hours: pad2(Math.floor(t / 3600)),
    minutes: pad2(Math.floor((t % 3600) / 60)),
    seconds: pad2(t % 60),
  };
}

export function WelcomeModal({
  open,
  onClose,
  cents = CAMPAIGN_REWARD_CENTS,
  title = REWARD_TITLE,
}: {
  open: boolean;
  onClose: () => void;
  cents?: number;
  title?: string;
  name?: string;
}) {
  const [left, setLeft] = useState(secondsUntilMidnightMX);

  useEffect(() => {
    if (!open) return;
    setLeft(secondsUntilMidnightMX());
    const id = window.setInterval(() => setLeft(secondsUntilMidnightMX()), 1000);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearInterval(id);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const clock = splitHms(left);

  return (
    <div className="modal-scrim reward-scrim" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <div className="reward-card">
        <img className="reward-gol" src="/reward-gol.png?v=2" alt="" />
        <h2 id="reward-title" className="reward-title">
          {title}
        </h2>
        <p className="reward-copy">
          ¡Enhorabuena! Como parte de una campaña de recompensas exclusiva.
        </p>
        <div className="reward-amount">
          <BankCount cents={cents} />
        </div>
        <div className="reward-timer">
          <span className="reward-timer-label">Expira en</span>
          <div className="reward-clock" aria-label={`Expira en ${clock.hours}:${clock.minutes}:${clock.seconds}`}>
            <span className="reward-box">{clock.hours}</span>
            <span className="reward-sep">:</span>
            <span className="reward-box">{clock.minutes}</span>
            <span className="reward-sep">:</span>
            <span className="reward-box">{clock.seconds}</span>
          </div>
        </div>
        <button type="button" className="btn reward-thanks" onClick={onClose}>
          Gracias
        </button>
      </div>
    </div>
  );
}
