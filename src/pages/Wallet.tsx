import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useAppState } from "../context/AppStateContext";
import { digitsOnly, formatClabe, isValidClabe } from "../lib/clabe";
import { formatMxn } from "../lib/money";
import { Coin } from "../components/Logo";
import { CountUp } from "../components/CountUp";
import { ResetTimer } from "../components/ResetTimer";
import { transitionTo } from "../lib/router";
import { DAILY_CAP_CENTS, MIN_WITHDRAWAL_CENTS, type LedgerEntry, type Withdrawal } from "../lib/types";

const CHIPS = [20, 40, 80];

export function Wallet() {
  const { user, refresh } = useAuth();
  const { balance, setBalance, patchUserData, setLastWithdrawal, userData } = useAppState();
  const [today, setToday] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [clabe, setClabe] = useState(user?.clabe ?? "");
  const [beneficiary, setBeneficiary] = useState(user?.beneficiaryName ?? "");
  const [amount, setAmount] = useState("");
  const [chip, setChip] = useState<number | "all" | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const wallet = await api.wallet();
    setBalance(wallet.balanceCents);
    setToday(wallet.todayCents);
    setLedger(wallet.ledger);
    setWithdrawals(wallet.withdrawals);
  }

  useEffect(() => {
    let cancelled = false;
    api
      .wallet()
      .then((wallet) => {
        if (cancelled) return;
        setBalance(wallet.balanceCents);
        setToday(wallet.todayCents);
        setLedger(wallet.ledger);
        setWithdrawals(wallet.withdrawals);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar la billetera.");
      });
    return () => {
      cancelled = true;
    };
  }, [setBalance]);

  useEffect(() => {
    setClabe(userData.clabe || userData.chave || user?.clabe || "");
    setBeneficiary(userData.nome || user?.beneficiaryName || "");
  }, [user, userData.clabe, userData.chave, userData.nome]);

  const lastCredit = useMemo(
    () => ledger.find((row) => row.kind === "credit"),
    [ledger],
  );

  function pickChip(value: number | "all") {
    setChip(value);
    if (value === "all") setAmount((balance / 100).toFixed(2));
    else setAmount(String(value));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    const cents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Escribe un monto válido en MXN.");
      return;
    }
    setBusy(true);
    try {
      await api.requestSpei(cents, clabe, beneficiary);
      patchUserData({
        nome: beneficiary,
        email: user?.email ?? "",
        clabe: digitsOnly(clabe),
        metodo: "SPEI",
      });
      setLastWithdrawal(cents);
      await refresh();
      await load();
      setAmount("");
      setChip(null);
      setOk("Solicitud SPEI registrada. Sale de tu saldo ganado.");
      window.dispatchEvent(new Event("lamantra:wallet"));
      transitionTo("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar el retiro.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <ResetTimer />
      <div className="saldo">
        <div className="container-saldo">
          <div className="saldo-info">
            <div className="saldo-label">
              <span>Tu saldo</span>
              <Coin />
            </div>
            <div className="valor-currency">
              <CountUp cents={balance} />
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Hoy {formatMxn(today)} de {formatMxn(DAILY_CAP_CENTS)}
            </p>
          </div>
        </div>
      </div>

      {lastCredit ? (
        <div className="saldo" style={{ marginTop: 12 }}>
          <div className="saldo-label">Última recompensa</div>
          <div className="valor-currency" style={{ fontSize: 16 }}>
            {lastCredit.label}
          </div>
          <span className="parabens-valor">{formatMxn(lastCredit.cents)}</span>
        </div>
      ) : null}

      <form className="bloco" onSubmit={onSubmit}>
        <div className="saldo-sacar-text">Confirmar retiro</div>
        <p className="soon-copy" style={{ maxWidth: "none" }}>
          SPEI a {userData.nome || "tu cuenta"} · {userData.email || "sin correo"} · mínimo {formatMxn(MIN_WITHDRAWAL_CENTS)} de saldo ya ganado.
        </p>
        <div className="botoes-row">
          {CHIPS.map((value) => (
            <button
              key={value}
              type="button"
              className={`btn-valor ${chip === value ? "is-on" : ""}`}
              onClick={() => pickChip(value)}
            >
              {formatMxn(value * 100)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`display-total btn-valor ${chip === "all" ? "is-on" : ""}`}
          onClick={() => pickChip("all")}
        >
          Todo · {formatMxn(balance)}
        </button>
        <label className="field">
          <span>Beneficiario</span>
          <input value={beneficiary} onChange={(e) => setBeneficiary(e.target.value)} required />
        </label>
        <label className="field">
          <span>CLABE</span>
          <input
            inputMode="numeric"
            value={formatClabe(clabe)}
            onChange={(e) => setClabe(digitsOnly(e.target.value))}
            placeholder="000 000 00000000000 0"
            required
          />
        </label>
        {clabe.length === 18 && !isValidClabe(clabe) ? (
          <p className="error">Esa CLABE no pasa el dígito verificador.</p>
        ) : null}
        <label className="field">
          <span>Monto (MXN)</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setChip(null);
              setAmount(e.target.value);
            }}
            placeholder="20.00"
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {ok ? <p className="ok">{ok}</p> : null}
        <button className="btn btn-block btn-square" disabled={busy || balance < MIN_WITHDRAWAL_CENTS}>
          {busy ? "Enviando…" : "Retirar dinero"}
        </button>
        <p className="small-text">
          El retiro descuenta tu saldo ganado. No hay cuota para liberarlo.
        </p>
      </form>

      <div className="bloco soon-card">
        <div className="container-saldo">
          <div>
            <div className="saldo-sacar-text">Lives de socios</div>
            <p className="soon-copy">Apoyo en directo a creators de LaMantra. Aún no está activo.</p>
          </div>
          <svg className="soon-mark" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx="36" cy="36" r="34" fill="#fff0f3" />
            <path d="M24 40c8-16 16-16 24 0" stroke="#fe2b54" strokeWidth="3" fill="none" />
            <circle cx="36" cy="28" r="8" fill="#fe2b54" />
          </svg>
        </div>
        <span className="btn-concluido">No disponible</span>
      </div>

      <div className="bloco soon-card">
        <div className="saldo-sacar-text">Recarga de tiempo aire</div>
        <p className="soon-copy">Datos y saldo telefónico en México. Lo activamos después del SPEI.</p>
        <span className="btn-concluido">No disponible</span>
      </div>

      <div className="bloco">
        <div className="saldo-label">Movimientos</div>
        {ledger.length === 0 ? (
          <p className="muted">Aún no hay movimientos. Mira un video de socio para empezar.</p>
        ) : (
          ledger.map((row) => (
            <div className="row" key={row.id}>
              <div>
                <strong>{row.label}</strong>
                <div className="muted">{new Date(row.createdAt).toLocaleString("es-MX")}</div>
              </div>
              <span style={{ color: row.cents < 0 ? "var(--danger)" : "var(--pink)", fontWeight: 700 }}>
                {formatMxn(row.cents)}
              </span>
            </div>
          ))
        )}
      </div>

      {withdrawals.length ? (
        <div className="bloco">
          <div className="saldo-label">Solicitudes SPEI</div>
          {withdrawals.map((row) => (
            <div className="row" key={row.id}>
              <div>
                <strong>{formatMxn(row.cents)}</strong>
                <div className="muted">
                  ****{row.clabe.slice(-4)} · {row.status === "pending" ? "en revisión" : row.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
