// True when this session was created with "Continue with Google" (OAuth), not with email and password.
// Supabase puts how the user signed in into the access token's "amr" claim; if it is missing we fall back
// to the provider stored on the user.
export function isGoogleSession(session) {
  if (!session) return false;
  try {
    const payload = JSON.parse(atob(session.access_token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (Array.isArray(payload.amr) && payload.amr.length > 0) {
      return payload.amr.some((a) => a?.method === "oauth" || a?.provider === "google");
    }
  } catch { /* fall through to the provider check */ }
  return session.user?.app_metadata?.provider === "google";
}

// Does this account have an email + password sign-in? (Google-only accounts cannot change a password.)
export function hasPasswordLogin(user) {
  const providers = user?.app_metadata?.providers ?? [user?.app_metadata?.provider];
  return providers.includes("email");
}

// Readable messages for the database errors raised by supabase_setup.sql.
export function friendlyDbError(message = "") {
  if (message.includes("invalid_tc"))        return "Please enter a valid T.C. Kimlik No.";
  if (message.includes("tc_taken"))          return "This T.C. Kimlik No is already registered to another account.";
  if (message.includes("tc_locked"))         return "Your T.C. Kimlik No is already saved and cannot be changed.";
  if (message.includes("not_patient"))       return "Only patient accounts can register a T.C. Kimlik No.";
  if (message.includes("not_authenticated")) return "Your session has expired. Please log in again.";
  if (message.includes("invalid_name"))      return "Please enter a valid name.";
  if (message.includes("does not exist") || message.includes("Could not find the function"))
    return "The database setup has not been run yet. Run supabase_setup.sql in Supabase first.";
  return message || "Something went wrong. Please try again.";
}

// ── Account type chosen on the login page (Doctor / Patient) ──
// The login page stores the choice; App.jsx checks it against the account's real role after sign-in.
// It expires after 10 minutes so an old choice can never affect a later session.
const LOGIN_INTENT_KEY = "neuroscan_login_role";

export function setLoginIntent(role) {
  try { sessionStorage.setItem(LOGIN_INTENT_KEY, JSON.stringify({ role, t: Date.now() })); } catch { /* storage unavailable */ }
}

export function clearLoginIntent() {
  try { sessionStorage.removeItem(LOGIN_INTENT_KEY); } catch { /* storage unavailable */ }
}

/** Returns the role chosen on the login page (or null) and clears it, so it is only used once. */
export function takeLoginIntent() {
  try {
    const raw = sessionStorage.getItem(LOGIN_INTENT_KEY);
    sessionStorage.removeItem(LOGIN_INTENT_KEY);
    if (!raw) return null;
    const { role, t } = JSON.parse(raw);
    return Date.now() - t < 10 * 60 * 1000 && (role === "doctor" || role === "patient") ? role : null;
  } catch { return null; }
}