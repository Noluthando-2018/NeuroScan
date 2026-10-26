import { useState } from "react";
import { supabase } from "../supabaseClient";
import { validateNewPassword, validateConfirmPassword, firstError } from "../utils/validators";

/** Shown when the user opens the link from the reset email (Supabase signs them in with a temporary recovery session). */
export default function ResetPasswordPage({ onDone, onCancel, toast }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handleSave = async () => {
    const validationError = firstError(validateNewPassword(password), validateConfirmPassword(confirm, password));
    if (validationError) { setError(validationError); return; }
    setLoading(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(/different from the old/i.test(error.message)
        ? "Your new password must be different from the old one."
        : error.message);
      setLoading(false);
      return;
    }
    toast?.success("Password updated", "You can now use your new password.");
    await onDone();
    setLoading(false);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>Set a new password</h1>
          <p>Choose a password you have not used before.</p>
        </div>
        {error && <div className="auth-error">⚠ {error}</div>}
        <div className="form-group">
          <label>New Password</label>
          <input type="password" placeholder="Min. 8 characters, with a letter and a number" autoComplete="new-password" value={password}
            onChange={e => { setPassword(e.target.value); setError(""); }} />
        </div>
        <div className="form-group">
          <label>Confirm New Password</label>
          <input type="password" placeholder="Repeat the password" value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(""); }}
            onKeyDown={e => e.key === "Enter" && handleSave()} />
        </div>
        <button className="btn-primary full-width" onClick={handleSave} disabled={loading}>
          {loading ? "Saving…" : "Update password"}
        </button>
        <p className="auth-link"><span onClick={onCancel}>Cancel</span></p>
      </div>
    </div>
  );
}
