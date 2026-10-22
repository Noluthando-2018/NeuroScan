import { useState } from "react";
import { supabase } from "../supabaseClient";
import CityHospitalFields from "../components/CityHospitalFields";
import {
  filterName, validateName, validateEmail, validateNewPassword,
  validateConfirmPassword, firstError, joinName,
} from "../utils/validators";

export default function RegisterPage({ nav, toast }) {
  const [role, setRole]         = useState("doctor");
  const [form, setForm]         = useState({ firstName: "", lastName: "", city: "", hospital: "", email: "", password: "", confirmPassword: "" });
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleRegister = async () => {
    const validationError = firstError(
      validateName(form.firstName, "First name"),
      validateName(form.lastName, "Last name"),
      role === "doctor" && !form.city ? "Please select your city." : null,
      role === "doctor" && !form.hospital.trim() ? "Please enter your hospital or institution." : null,
      validateEmail(form.email),
      validateNewPassword(form.password),
      validateConfirmPassword(form.confirmPassword, form.password),
    );
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError("");

    const email = form.email.trim();
    const fullName = joinName(form.firstName, form.lastName);

    // Step 1 — Create Supabase auth account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: form.password,
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        setError("An account with this email already exists. Please log in instead.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    if (!authData?.user?.id) {
      setError("Registration failed. Please try again.");
      setLoading(false);
      return;
    }

    // Step 2 — Insert profile into users table
    const { error: dbError } = await supabase.from("users").insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      role: role,
      city: role === "doctor" ? form.city : null,
      hospital: role === "doctor" ? form.hospital.trim() : null,
      password_hash: "managed_by_supabase_auth",
    });

    if (dbError) {
      if (!dbError.message.includes("duplicate")) {
        setError("Profile setup failed: " + dbError.message);
        setLoading(false);
        return;
      }
    }


    setLoading(false);
    setSuccess(true);
    toast.success("Account created!", "Your NeuroScan account is ready. You can now log in.");
  };

  if (success) return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "var(--success-dim)", border: "2px solid var(--success)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, margin: "0 auto 20px"
          }}>✓</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>
            You're all set, {form.firstName.trim()}!
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 6 }}>
            Your NeuroScan {role} account has been created successfully.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 28 }}>
            You can now log in and {role === "doctor" ? "start managing patient cases." : "view your MRI results."}
          </p>
        </div>
        <div style={{
          background: "var(--bg-alt)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 24
        }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Account Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Name</span>
              <strong style={{ color: "var(--text-primary)" }}>{joinName(form.firstName, form.lastName)}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Email</span>
              <strong style={{ color: "var(--text-primary)" }}>{form.email}</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>Role</span>
              <span className={`badge ${role === "doctor" ? "badge-blue" : "badge-green"}`}>{role}</span>
            </div>
            {role === "doctor" && form.city && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>City</span>
                <strong style={{ color: "var(--text-primary)" }}>{form.city}</strong>
              </div>
            )}
            {form.hospital && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "var(--text-muted)" }}>Hospital</span>
                <strong style={{ color: "var(--text-primary)" }}>{form.hospital}</strong>
              </div>
            )}
          </div>
        </div>
        <button className="btn-primary full-width" onClick={() => nav("login")}>
          Continue to Login →
        </button>
        <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 16 }}>
          Keep your login credentials safe and do not share them.
        </p>
      </div>
    </div>
  );

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>Create Account</h1>
          <p>Create your NeuroScan account</p>
        </div>
        <div className="role-toggle">
          <button className={role === "doctor" ? "active" : ""}  onClick={() => setRole("doctor")}>Doctor</button>
          <button className={role === "patient" ? "active" : ""} onClick={() => setRole("patient")}>Patient</button>
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="form-grid">
          <div className="form-group">
            <label>First Name</label>
            <input type="text" placeholder="Ayşe" autoComplete="given-name" value={form.firstName}
              onChange={e => update("firstName", filterName(e.target.value))} />
          </div>
          <div className="form-group">
            <label>Last Name</label>
            <input type="text" placeholder="Çelik" autoComplete="family-name" value={form.lastName}
              onChange={e => update("lastName", filterName(e.target.value))} />
          </div>
        </div>
        {role === "doctor" && (
          <CityHospitalFields
            city={form.city} hospital={form.hospital}
            onChange={(city, hospital) => setForm(f => ({ ...f, city, hospital }))}
          />
        )}
        <div className="form-group">
          <label>Email Address</label>
          <input type="email" placeholder="you@hospital.com" value={form.email} onChange={e => update("email", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" placeholder="Min. 8 characters, with a letter and a number" autoComplete="new-password"
            value={form.password} onChange={e => update("password", e.target.value)} />
        </div>
        <div className="form-group">
          <label>Confirm Password</label>
          <input type="password" placeholder="Repeat your password" autoComplete="new-password"
            value={form.confirmPassword} onChange={e => update("confirmPassword", e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleRegister()} />
        </div>
        <button className="btn-primary full-width" onClick={handleRegister} disabled={loading}>
          {loading ? "Creating account…" : "Create Account"}
        </button>
        <p className="auth-link">Already have an account? <span onClick={() => nav("login")}>Login</span></p>
      </div>
    </div>
  );
}
