
import { useState } from "react";
import { supabase } from "../supabaseClient";
import { filterName, validateName, firstError, joinName, splitFullName } from "../utils/validators";

export default function CompleteGoogleProfile({
  session,
  nav,
  onComplete,
}) {
  const user = session?.user;

  const metadata = user?.user_metadata ?? {};
  // Pre-fill first / last name from the Google account when available.
  const [initialFirst, initialLast] =
    metadata.given_name || metadata.family_name
      ? [metadata.given_name ?? "", metadata.family_name ?? ""]
      : splitFullName(metadata.full_name ?? metadata.name ?? "");

  const [firstName, setFirstName] = useState(filterName(initialFirst));
  const [lastName, setLastName] = useState(filterName(initialLast));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const email = user?.email ?? "";

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!user) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const validationError = firstError(
      validateName(firstName, "First name"),
      validateName(lastName, "Last name")
    );
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const profileData = {
        id: user.id,
        email,
        full_name: joinName(firstName, lastName),
        role: "patient",   // Google sign-in is for patients only; doctors register with email and password
        password_hash: "managed_by_supabase_auth",
      };

      const { data: profile, error: insertError } =
        await supabase
          .from("users")
          .insert(profileData)
          .select()
          .single();

      if (insertError) throw insertError;

      onComplete(profile);
    } catch (err) {
      console.error("Google profile completion error:", err);

      if (err.code === "23505") {
        setError(
          "A profile already exists for this account. Please sign in again."
        );
      } else if (err.code === "42501") {
        setError(
          "Database permissions prevented profile creation. Check your Supabase RLS policies."
        );
      } else {
        setError(
          err.message ?? "Unable to create your profile. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (loading) return;

    await supabase.auth.signOut();
    nav("login");
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-logo">⬡</span>
          <h1>Complete Your Profile</h1>
          <p>Welcome to NeuroScan</p>
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
          You're signed in with Google. Complete the details below
          to create your patient account.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Google sign-in is for patients only. Doctors register with
          their email and password.
        </p>

        {error && (
          <div className="auth-error" role="alert">
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(filterName(event.target.value))}
                placeholder="Ayşe"
                autoComplete="given-name"
                required
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(filterName(event.target.value))}
                placeholder="Çelik"
                autoComplete="family-name"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              value={email}
              readOnly
              disabled
            />
          </div>

          <button
            type="submit"
            className="btn-primary full-width"
            disabled={loading}
          >
            {loading ? "Saving profile…" : "Complete Profile"}
          </button>
        </form>

        <p className="auth-link">
          <span onClick={handleCancel}>Cancel and sign out</span>
        </p>
      </div>
    </div>
  );
}
