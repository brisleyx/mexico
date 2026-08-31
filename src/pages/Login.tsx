import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { appState } from "../lib/appState";

export function Login() {
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.signIn(email, password);
      await refresh();
      if (appState.get().currentStep === "presell") {
        appState.setStep("one");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <h1 className="title">
        <Link to="/">
          <Logo />
        </Link>
      </h1>
      <form className="auth-card" onSubmit={onSubmit}>
        <h2 className="page-h">Entrar</h2>
        <p className="hint">Usa el correo con el que te registraste.</p>
        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <p className="auth-foot">
          ¿No tienes cuenta? <Link to="/registro">Crear cuenta</Link>
        </p>
      </form>
    </div>
  );
}
