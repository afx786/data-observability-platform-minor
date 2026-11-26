import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext.jsx";
import SpatialBackground from "../components/SpatialBackground.jsx";
import StitchIcon from "../components/StitchIcon.jsx";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const from = location.state?.from?.pathname ?? "/";

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <SpatialBackground />

      <form onSubmit={handleSubmit} className="login-card">
        <div className="relative flex items-center gap-3">
          <StitchIcon />
          <div className="min-w-0">
            <p className="font-stitch-headline text-[15px] font-semibold leading-tight text-[#0F172A]">
              Data Observability
            </p>
            <p className="text-[11px] font-medium text-[#475569]">Monitoring &amp; investigation</p>
          </div>
        </div>

        <p className="stitch-eyebrow relative mt-8">Secure access · telemetry console</p>
        <h1 className="relative mt-2 font-stitch-headline text-[34px] font-semibold leading-[1.12] tracking-[-0.025em] text-[#0F172A]">
          Welcome back
        </h1>
        <p className="relative mt-2.5 text-[13px] leading-relaxed text-[#475569]">
          Sign in to inspect pipeline health, profiles and active incidents.
        </p>

        <div className="stitch-divider relative my-6" />

        <label className="login-field-label relative block">
          Email
          <input
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            className="login-input"
          />
        </label>

        <label className="login-field-label relative mt-4 block">
          Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••••••"
            className="login-input"
          />
        </label>

        {error && (
          <p className="login-error relative mt-4" role="alert">
            <span className="material-symbols-outlined mt-px text-[16px]" aria-hidden="true">
              lock
            </span>
            <span>{error}</span>
          </p>
        )}

        <button type="submit" disabled={busy} className="login-submit stitch-shine relative mt-6">
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div className="login-footer relative">
          <span>TLS 1.3 · ENCRYPTED SESSION</span>
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="stitch-live-dot" />
            ENGINE v2.4 ACTIVE
          </span>
        </div>
      </form>
    </div>
  );
}
