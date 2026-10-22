import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function ForgotPasswordPage({ nav }) {
  const [email, setEmail]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [sent, setSent]         = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // 60 s pause before the link can be requested again (protects the email quota)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSend = async () => {
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,      // the link in the email brings the user back here
    });
    setLoading(false);
    if (error) {
      setError(/rate limit/i.test(error.message)
        ? "Too many requests. Please wait a few minutes and try again."
        : error.message);
      return;
    }
    setSent(true);
    setCooldown(60);
  };

  if (sent) return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "var(--success-dim)", border: "2px solid var(--success)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px"
        }}>✉</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>Check your email</h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
          If an account exists for <strong>{email}</strong>, we have sent a link to reset your password.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
          It may take a minute. Check your spam folder too.
        </p>
        <button className="btn-ghost full-width" onClick={handleSend} disabled={cooldown > 0 || loading}>
          {cooldown > 0 ? `Send again in ${cooldown}s` : "Send the link again"}
        </button>
        <p className="auth-link"><span onClick={() => nav("login")}>← Back to login</span></p>
      </div>
    </div>
  );

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>Forgot password?</h1>
          <p>Enter your email and we will send you a reset link.</p>
        </div>
        {error && <div className="auth-error">⚠ {error}</div>}
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" placeholder="you@hospital.com" value={email}
            onChange={e => { setEmail(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSend()} />
        </div>
        <button className="btn-primary full-width" onClick={handleSend} disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
        <p className="auth-link"><span onClick={() => nav("login")}>← Back to login</span></p>
      </div>
    </div>
  );
}
