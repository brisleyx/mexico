import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { AppStateProvider, RouterBridge } from "./context/AppStateContext";
import { AppShell } from "./components/AppShell";
import { GuestOnly, ProtectedRoute } from "./components/Guards";
import { Funnel } from "./pages/Funnel";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Watch } from "./pages/Watch";
import { Profile } from "./pages/Profile";

export function App() {
  return (
    <AuthProvider>
      <AppStateProvider>
        <BrowserRouter>
          <RouterBridge />
          <Routes>
            <Route element={<Funnel />}>
              <Route path="/" element={null} />
              <Route path="/app" element={null} />
              <Route path="/app/cargando" element={null} />
              <Route path="/app/billetera" element={null} />
              <Route path="/app/retiro" element={null} />
              <Route path="/app/pago" element={null} />
              <Route path="/app/exito" element={null} />
            </Route>
            <Route element={<GuestOnly />}>
              <Route path="/entrar" element={<Login />} />
              <Route path="/registro" element={<Register />} />
            </Route>
            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route path="/app/ver/:id" element={<Watch />} />
                <Route path="/app/perfil" element={<Profile />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppStateProvider>
    </AuthProvider>
  );
}
