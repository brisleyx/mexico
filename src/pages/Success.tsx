import { Coin } from "../components/Logo";
import { useAppState } from "../context/AppStateContext";
import { formatMxn } from "../lib/money";

export function SuccessScreen() {
  const { userData, lastWithdrawalCents, balance } = useAppState();
  const clabeTail = (userData.clabe || userData.chave).replace(/\s/g, "").slice(-4);

  return (
    <div className="withdraw-flow-panel">
      <div className="bloco success-card">
        <div className="success-mark" aria-hidden="true">
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="34" fill="#ecfdf3" />
            <path d="M22 37.5 31 46.5 50 26.5" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="page-h">Solicitud enviada</h2>
        <p className="muted">
          {lastWithdrawalCents
            ? `Registramos tu retiro ${userData.metodo || "SPEI"} de ${formatMxn(lastWithdrawalCents)}. Sale de tu saldo ya ganado.`
            : `Registramos tu retiro ${userData.metodo || "SPEI"}. Sale de tu saldo ya ganado.`}
        </p>
        <div className="success-facts">
          <div>
            <span className="saldo-label">Beneficiario</span>
            <strong>{userData.nome || "—"}</strong>
          </div>
          <div>
            <span className="saldo-label">{userData.metodo || "SPEI"}</span>
            <strong>{clabeTail ? `****${clabeTail}` : "—"}</strong>
          </div>
          <div>
            <span className="saldo-label">
              Saldo restante <Coin />
            </span>
            <strong>{formatMxn(balance)}</strong>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-block btn-square"
          onClick={() => {
            window.location.href = "https://www.tiktok.com";
          }}
        >
          Volver a videos
        </button>
      </div>
    </div>
  );
}
