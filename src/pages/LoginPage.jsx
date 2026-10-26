import { useState } from "react";
import { supabase } from "../supabaseClient";
import { setLoginIntent, clearLoginIntent } from "../utils/auth";

export default function LoginPage({ nav }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [role, setRole] = useState("doctor");   // "doctor" | "patient" — checked against the account after sign-in

  // Email/password login
  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");
    setLoginIntent(role);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        clearLoginIntent();
        setError(
          error.message.includes("Invalid login")
            ? "Incorrect email or password. Please try again."
            : error.message
        );
        return;
      }

      // App.jsx listens for the new session, loads the profile and opens the dashboard.
      // If that fails, App.jsx resets this page (the "key" changes), so it cannot get stuck here.
      setSigningIn(true);
    } catch (err) {
      clearLoginIntent();
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth login (patients only — App.jsx signs a doctor out again if they use it)
  const handleGoogleLogin = async () => {
    if (loading) return;

    setLoading(true);
    setError("");
    setLoginIntent("patient");

    try {
      const redirectUrl = new URL(window.location.href);
      redirectUrl.search = "";
      redirectUrl.hash = "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl.toString(),
          queryParams: { prompt: "select_account" },   // let the user pick the Google account
        },
      });

      if (error) {
        clearLoginIntent();
        setError(error.message);
        setLoading(false);
      }
      // On success the browser leaves for Google, so the button stays disabled until then.
    } catch (err) {
      clearLoginIntent();
      console.error("Google login error:", err);
      setError("Unable to start Google sign-in. Please try again.");
      setLoading(false);
    }
  };

  if (signingIn) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card" style={{ textAlign: "center", padding: "48px 40px" }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "var(--accent-dim)", border: "2px solid var(--accent-mid)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24, margin: "0 auto 20px", color: "var(--accent)",
            }}
          >
            ⬡
          </div>

          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            Signing you in…
          </h2>

          <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Loading your dashboard, please wait.
          </p>

          <div
            style={{
              marginTop: 24, height: 4, background: "var(--bg-alt)",
              borderRadius: 4, overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%", background: "var(--accent)", borderRadius: 4,
                width: "60%", animation: "pulse 1.2s ease-in-out infinite",
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>NeuroScan</h1>
          <p>Brain MRI Analysis Platform</p>
        </div>

        <div className="role-toggle">
          <button type="button" className={role === "doctor" ? "active" : ""} disabled={loading}
            onClick={() => { setRole("doctor"); setError(""); }}>Doctor</button>
          <button type="button" className={role === "patient" ? "active" : ""} disabled={loading}
            onClick={() => { setRole("patient"); setError(""); }}>Patient</button>
        </div>

        {error && <div className="auth-error">⚠ {error}</div>}

        <div className="form-group">
          <label>Email Address</label>
          <input
            type="email"
            placeholder="you@hospital.com"
            value={email}
            disabled={loading}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            disabled={loading}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
          />
        </div>

        <p className="auth-link" style={{ textAlign: "right", margin: "-4px 0 14px" }}>
          <span onClick={() => nav("forgotPassword")}>Forgot password?</span>
        </p>

        <button className="btn-primary full-width" onClick={handleLogin} disabled={loading}>
          {loading ? "Please wait…" : "Login"}
        </button>

        {role === "patient" ? (<>
        <div className="auth-divider"><span>or</span></div>

        <button type="button" className="btn-google" onClick={handleGoogleLogin} disabled={loading}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"/>
            <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/>
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
        <p className="auth-note">Google sign-in is available for patients.</p>
        </>) : (
          <p className="auth-note">Doctors log in with their email and password.</p>
        )}

        <p className="auth-link">
          Don't have an account? <span onClick={() => nav("register")}>Register</span>
        </p>
      </div>
    </div>
  );
}