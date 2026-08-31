import { useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { digitsOnly, formatClabe, isValidClabe } from "../lib/clabe";

export function Profile() {
  const { user, refresh, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [beneficiaryName, setBeneficiaryName] = useState(user?.beneficiaryName ?? "");
  const [clabe, setClabe] = useState(user?.clabe ?? "");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (clabe && !isValidClabe(clabe)) {
      setError("CLABE no válida.");
      return;
    }
    setBusy(true);
    try {
      await api.updateProfile({ displayName, beneficiaryName, clabe });
      await refresh();
      setOk("Perfil guardado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="saldo">
        <div className="saldo-label">Tu cuenta</div>
        <div className="valor-currency">{user?.displayName}</div>
        <p className="muted" style={{ margin: 0 }}>
          {user?.email}
        </p>
      </div>
      <form className="bloco" onSubmit={onSubmit}>
        <label className="field">
          <span>Nombre en LaMantra</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label className="field">
          <span>Nombre del beneficiario SPEI</span>
          <input value={beneficiaryName} onChange={(e) => setBeneficiaryName(e.target.value)} />
        </label>
        <label className="field">
          <span>CLABE</span>
          <input
            inputMode="numeric"
            value={formatClabe(clabe)}
            onChange={(e) => setClabe(digitsOnly(e.target.value))}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        {ok ? <p className="ok">{ok}</p> : null}
        <button className="btn btn-block" disabled={busy}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </form>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 12 }} onClick={() => signOut()}>
        Cerrar sesión
      </button>
    </section>
  );
}
