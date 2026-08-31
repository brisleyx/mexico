import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { resumePathAfterAuth } from "../lib/router";

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <p className="wrap muted" style={{ paddingTop: 48 }}>Cargando…</p>;
  if (!user) return <Navigate to="/entrar" replace />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <p className="wrap muted" style={{ paddingTop: 48 }}>Cargando…</p>;
  if (user) return <Navigate to={resumePathAfterAuth()} replace />;
  return <Outlet />;
}
