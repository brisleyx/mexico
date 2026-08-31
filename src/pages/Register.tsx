import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { appState } from "../lib/appState";

export function Register() {
  const { refresh } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.signUp(email, password, displayName);
      appState.reset();
      appState.setStep("one");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
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
        <h2 className="page-h">Crear cuenta</h2>
        <p className="hint">Tu CLABE se guarda después, en Perfil.</p>
        <label className="field">
          <span>Nombre</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required minLength={2} />
        </label>
        <label className="field">
          <span>Correo</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field">
          <span>Contraseña (mín. 8)</span>
          <input
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
        <p className="auth-foot">
          ¿Ya tienes cuenta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
