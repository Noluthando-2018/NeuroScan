import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import Avatar from "../components/Avatar";
import CityHospitalFields from "../components/CityHospitalFields";
import {
  filterName, filterTc, validateName, validateTc, validateNewPassword,
  validateConfirmPassword, firstError, joinName, splitFullName,
} from "../utils/validators";
import { hasPasswordLogin, friendlyDbError } from "../utils/auth";

// Profile screen: avatar, details, and editing (name, doctor's city/hospital, patient's T.C., password).
export default function ProfilePage({ userProfile, session, onLogout, onProfileUpdated, toast }) {
  const isDoctor = userProfile?.role === "doctor";
  const canChangePassword = hasPasswordLogin(session?.user);

  // ── Profile details ──
  const [editing, setEditing]     = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [city, setCity]           = useState("");
  const [hospital, setHospital]   = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  // ── Patient T.C. Kimlik No ──
  const [hasTc, setHasTc]         = useState(null);   // null = still loading / unavailable
  const [tcInput, setTcInput]     = useState("");
  const [tcSaving, setTcSaving]   = useState(false);
  const [tcError, setTcError]     = useState("");

  // ── Password ──
  const [pwOpen, setPwOpen]       = useState(false);
  const [newPw, setNewPw]         = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwError, setPwError]     = useState("");

  useEffect(() => {
    if (!userProfile || isDoctor) return;
    let cancelled = false;
    supabase.rpc("get_my_tc_status").then(({ data, error: rpcErr }) => {
      if (cancelled) return;
      if (rpcErr) { console.warn("get_my_tc_status failed:", rpcErr.message); setHasTc(null); return; }
      setHasTc(!!data?.has_tc);
    });
    return () => { cancelled = true; };
  }, [userProfile, isDoctor]);

  if (!userProfile) return null;

  const startEdit = () => {
    const [first, last] = splitFullName(userProfile.full_name);
    setFirstName(filterName(first)); setLastName(filterName(last));
    setCity(userProfile.city ?? ""); setHospital(userProfile.hospital ?? "");
    setError(""); setEditing(true);
  };

  const saveProfile = async () => {
    const validationError = firstError(
      validateName(firstName, "First name"),
      validateName(lastName, "Last name"),
      isDoctor && !city ? "Please select your city." : null,
      isDoctor && !hospital.trim() ? "Please enter your hospital or institution." : null,
    );
    if (validationError) { setError(validationError); return; }

    setSaving(true); setError("");
    const { data, error: rpcErr } = await supabase.rpc("update_my_profile", {
      p_full_name: joinName(firstName, lastName),
      p_city: isDoctor ? city : null,
      p_hospital: isDoctor ? hospital.trim() : null,
    });
    setSaving(false);

    if (rpcErr || !data) {
      if (rpcErr) console.error("update_my_profile failed:", rpcErr.message);
      setError(friendlyDbError(rpcErr?.message));
      return;
    }
    onProfileUpdated?.({ ...userProfile, ...data });
    setEditing(false);
    toast?.success("Profile updated", "Your changes have been saved.");
  };

  const saveTc = async () => {
    const validationError = validateTc(tcInput);
    if (validationError) { setTcError(validationError); return; }
    setTcSaving(true); setTcError("");
    const { data, error: rpcErr } = await supabase.rpc("claim_tc_and_link", { p_tc: tcInput.trim() });
    setTcSaving(false);

    if (rpcErr) {
      console.error("claim_tc_and_link failed:", rpcErr.message);
      setTcError(friendlyDbError(rpcErr.message));
      return;
    }
    setTcInput(""); setHasTc(true);
    const n = data?.linked ?? 0;
    toast?.success(
      "T.C. Kimlik No saved",
      n > 0
        ? `${n} case${n > 1 ? "s were" : " was"} linked to your account. Open My Results to view them.`
        : "Your results will appear automatically as soon as your doctor adds your scan."
    );
  };

  const savePassword = async () => {
    const validationError = firstError(validateNewPassword(newPw), validateConfirmPassword(confirmPw, newPw));
    if (validationError) { setPwError(validationError); return; }
    setPwSaving(true); setPwError("");
    const { error: authErr } = await supabase.auth.updateUser({ password: newPw });
    setPwSaving(false);
    if (authErr) {
      setPwError(/different from the old/i.test(authErr.message)
        ? "Your new password must be different from the old one."
        : authErr.message);
      return;
    }
    setNewPw(""); setConfirmPw(""); setPwOpen(false);
    toast?.success("Password updated", "Use your new password next time you log in.");
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h2>My Profile</h2><p className="subtitle">Your account details</p></div>
      </div>

      <div className="profile-wrap">
        <div className="profile-hero">
          <Avatar name={userProfile.full_name} size={96} />
          <h3 className="profile-name">{userProfile.full_name}</h3>
          <span className={`badge ${isDoctor ? "badge-blue" : "badge-green"}`}>
            {isDoctor ? "Doctor" : "Patient"}
          </span>
        </div>

        {/* ── Details ── */}
        <div className="card profile-info">
          {!editing ? (
            <>
              <InfoRow label="Email" value={userProfile.email} />
              {isDoctor && userProfile.hospital && (<><hr className="profile-divider" /><InfoRow label="Hospital" value={userProfile.hospital} /></>)}
              {isDoctor && userProfile.city && (<><hr className="profile-divider" /><InfoRow label="City" value={userProfile.city} /></>)}
              <button className="btn-ghost profile-edit-btn" onClick={startEdit}>✎ Edit Profile</button>
            </>
          ) : (
            <>
              {error && <div className="auth-error">⚠ {error}</div>}
              <div className="form-grid">
                <div className="form-group">
                  <label>First Name</label>
                  <input type="text" value={firstName} autoComplete="given-name"
                    onChange={e => { setFirstName(filterName(e.target.value)); setError(""); }} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input type="text" value={lastName} autoComplete="family-name"
                    onChange={e => { setLastName(filterName(e.target.value)); setError(""); }} />
                </div>
              </div>
              {isDoctor && (
                <CityHospitalFields city={city} hospital={hospital}
                  onChange={(c, h) => { setCity(c); setHospital(h); setError(""); }} />
              )}
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={userProfile.email} disabled />
                <p className="hint" style={{ marginTop: 6 }}>Your email is your login and cannot be changed here.</p>
              </div>
              <div className="profile-actions">
                <button className="btn-ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                <button className="btn-primary" onClick={saveProfile} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</button>
              </div>
            </>
          )}
        </div>

        {/* ── Patient: T.C. Kimlik No (links cases automatically) ── */}
        {!isDoctor && (
          <div className="card profile-info">
            <div className="profile-section-title">T.C. Kimlik No</div>
            {hasTc ? (
              <p className="hint" style={{ margin: 0 }}>
                ✓ Registered. Your cases are linked to your account automatically, including new ones your doctor adds later.
              </p>
            ) : (
              <>
                <p className="hint" style={{ marginTop: 0 }}>
                  Enter your T.C. Kimlik No once. Every case your doctor has saved for you is then linked to your account
                  automatically. It cannot be changed afterwards.
                </p>
                {tcError && <div className="auth-error">⚠ {tcError}</div>}
                <div className="form-group">
                  <input type="text" inputMode="numeric" autoComplete="off" placeholder="11-digit T.C. Kimlik No"
                    value={tcInput} onChange={e => { setTcInput(filterTc(e.target.value)); setTcError(""); }}
                    onKeyDown={e => e.key === "Enter" && saveTc()} />
                </div>
                <button className="btn-primary" onClick={saveTc} disabled={tcSaving}>{tcSaving ? "Saving…" : "Save & Link My Cases"}</button>
              </>
            )}
          </div>
        )}

        {/* ── Password (email accounts only) ── */}
        {canChangePassword && (
          <div className="card profile-info">
            <div className="profile-section-title">Password</div>
            {!pwOpen ? (
              <button className="btn-ghost" onClick={() => { setPwOpen(true); setPwError(""); }}>🔑 Change Password</button>
            ) : (
              <>
                {pwError && <div className="auth-error">⚠ {pwError}</div>}
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" autoComplete="new-password" placeholder="Min. 8 characters, with a letter and a number"
                    value={newPw} onChange={e => { setNewPw(e.target.value); setPwError(""); }} />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" autoComplete="new-password" placeholder="Repeat the password"
                    value={confirmPw} onChange={e => { setConfirmPw(e.target.value); setPwError(""); }}
                    onKeyDown={e => e.key === "Enter" && savePassword()} />
                </div>
                <div className="profile-actions">
                  <button className="btn-ghost" onClick={() => { setPwOpen(false); setNewPw(""); setConfirmPw(""); }} disabled={pwSaving}>Cancel</button>
                  <button className="btn-primary" onClick={savePassword} disabled={pwSaving}>{pwSaving ? "Saving…" : "Update Password"}</button>
                </div>
              </>
            )}
          </div>
        )}

        <button className="btn-ghost profile-logout" onClick={onLogout}>⇦ Logout</button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="profile-row">
      <span className="profile-row-label">{label}</span>
      <span className="profile-row-value">{value}</span>
    </div>
  );
}
