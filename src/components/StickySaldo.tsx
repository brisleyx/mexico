import { CountUp } from "./CountUp";
import { transitionTo } from "../lib/router";

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function StickySaldo({
  visible,
  cents,
  secondsLeft,
}: {
  visible: boolean;
  cents: number;
  secondsLeft: number;
}) {
  const t = Math.max(0, secondsLeft);
  const hours = pad2(Math.floor(t / 3600));
  const minutes = pad2(Math.floor((t % 3600) / 60));
  const seconds = pad2(t % 60);

  return (
    <div className={`sticky-bar ${visible ? "is-visible" : ""}`}>
      <div className="sticky-expire">
        <span className="reward-timer-label">Expira en</span>
        <div className="reward-clock" aria-label={`Expira en ${hours}:${minutes}:${seconds}`}>
          <span className="reward-box">{hours}</span>
          <span className="reward-sep">:</span>
          <span className="reward-box">{minutes}</span>
          <span className="reward-sep">:</span>
          <span className="reward-box">{seconds}</span>
        </div>
      </div>
      <div className="saldo sticky-saldo">
        <div className="container-saldo">
          <div className="saldo-info">
            <div className="saldo-label">
              <span>Tu saldo</span>
              <span className="p-saldo" aria-hidden="true">
                P
              </span>
            </div>
            <div className="valor-currency">
              <CountUp cents={cents} />
            </div>
          </div>
          <button type="button" className="btn btn-sacar" onClick={() => transitionTo("loading")}>
            Retirar
          </button>
        </div>
      </div>
    </div>
  );
}
