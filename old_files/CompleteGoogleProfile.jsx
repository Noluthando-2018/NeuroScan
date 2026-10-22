import { useState } from "react";
import { supabase } from "../supabaseClient";
import CityHospitalFields from "../components/CityHospitalFields";

/**
 * Shown after the FIRST Google sign-in. Google creates the login, but NeuroScan also needs a row in
 * the `users` table (role, city, hospital). Same fields and look as the Register page.
 */
export default function CompleteGoogleProfile({ session, nav, onComplete }) {
  const user = session?.user;

  const [fullName, setFullName] = useState(
    user?.user_metadata?.full_name || user?.user_metadata?.name || ""
  );
  const [role, setRole] = useState("patient");
  const [city, setCity] = useState("");
  const [hospital, setHospital] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!user) {
      setError("Your session has expired. Please log in again.");
      return;
    }
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (role === "doctor" && !city) {
      setError("Please select your city.");
      return;
    }
    if (role === "doctor" && !hospital.trim()) {
      setError("Please enter your hospital or institution.");
      return;
    }

    setLoading(true);

    try {
      // Does this user already have a profile?
      const { data: existingProfile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (existingProfile) {
        onComplete(existingProfile);
        return;
      }

      const { data: profile, error: insertError } = await supabase
        .from("users")
        .insert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim(),
          role,
          city: role === "doctor" ? city : null,
          hospital: role === "doctor" ? hospital.trim() : null,
          password_hash: "managed_by_supabase_auth",   // same placeholder as the email/password registration
        })
        .select()
        .single();

      if (insertError) throw insertError;

      onComplete(profile);
    } catch (err) {
      console.error("Profile completion error:", err);

      if (err.code === "23505") {
        setError("A profile already exists for this account. Please log in again.");
      } else if (err.code === "42501") {
        setError("Permission denied. Please check your Supabase database policies.");
      } else {
        setError(err.message || "Could not complete your profile. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      nav("login");
    } catch (err) {
      console.error("Sign-out error:", err);
      setError("Could not sign out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>Complete Your Profile</h1>
          <p>
            Signed in with Google as <strong>{user?.email}</strong>.<br />
            A few details to finish setting up your account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="role-toggle">
            <button type="button" className={role === "doctor" ? "active" : ""} onClick={() => setRole("doctor")}>Doctor</button>
            <button type="button" className={role === "patient" ? "active" : ""} onClick={() => setRole("patient")}>Patient</button>
          </div>

          {error && <div className="auth-error" role="alert">⚠ {error}</div>}

          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName" type="text" placeholder="Dr. Jane Doe"
              value={fullName} disabled={loading}
              onChange={(e) => { setFullName(e.target.value); setError(""); }}
            />
          </div>

          {role === "doctor" && (
            <CityHospitalFields
              city={city} hospital={hospital}
              onChange={(c, h) => { setCity(c); setHospital(h); setError(""); }}
            />
          )}

          <button type="submit" className="btn-primary full-width" disabled={loading}>
            {loading ? "Saving…" : "Complete Profile"}
          </button>

          <p className="auth-link">
            <span onClick={loading ? undefined : handleCancel}>Cancel and return to login</span>
          </p>
        </form>
      </div>
    </div>
  );
}
