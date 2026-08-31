import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Logo } from "./Logo";
import { useAppState } from "../context/AppStateContext";
import { transitionTo } from "../lib/router";

const titles: Record<string, string> = {
  "/app": "LaMantra",
  "/app/billetera": "Canjear recompensas",
  "/app/retiro": "Añadir método de retiro",
  "/app/pago": "Confirmar crédito",
  "/app/exito": "Listo",
  "/app/perfil": "Perfil",
};

export function AppShell({ children }: { children?: ReactNode }) {
  const location = useLocation();
  const { currentStep } = useAppState();
  const plain = currentStep === "loading" || location.pathname === "/app/cargando";
  const withdrawFlow = ["checkout", "five", "payment-gateway", "success"].includes(currentStep);
  const hideTitle =
    plain ||
    withdrawFlow ||
    location.pathname === "/app/billetera" ||
    location.pathname === "/app/retiro" ||
    location.pathname === "/app/pago" ||
    location.pathname === "/app/exito";
  const hideNav = hideTitle;
  const funnelPad = withdrawFlow;
  const title =
    titles[location.pathname] ??
    (location.pathname.startsWith("/app/ver") ? "Ver campaña" : "LaMantra");

  return (
    <div className={`app-shell${plain ? " is-plain" : ""}`}>
      {hideTitle ? null : <h1 className="title">{location.pathname === "/app" ? <Logo /> : title}</h1>}
      <main className={`wrap${funnelPad ? " wrap-funnel" : ""}`}>{children ?? <Outlet />}</main>
      {hideNav || plain ? null : (
        <nav className="bottom-nav">
          <NavLink
            to="/app"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={(event) => {
              event.preventDefault();
              transitionTo("one");
            }}
          >
            Videos
          </NavLink>
          <NavLink
            to="/app/billetera"
            className={({ isActive }) =>
              isActive || ["checkout", "five", "payment-gateway", "success"].includes(currentStep)
                ? "active"
                : ""
            }
            onClick={(event) => {
              event.preventDefault();
              transitionTo("checkout");
            }}
          >
            Retirar
          </NavLink>
          <NavLink to="/app/perfil" className={({ isActive }) => (isActive ? "active" : "")}>
            Perfil
          </NavLink>
        </nav>
      )}
    </div>
  );
}
