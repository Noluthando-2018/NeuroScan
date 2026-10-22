// Shared form validators — a port of the mobile app's validators.dart so web and mobile follow the same rules.
// Every validator returns an error message (string) or null when the value is valid.

// Any Unicode letter (ç, ğ, ı, İ, ö, ş, ü ...) + combining marks, with single space / apostrophe / hyphen separators.
const NAME_RE  = /^\p{L}[\p{L}\p{M}]*(?:[ '’-]\p{L}[\p{L}\p{M}]*)*$/u;
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

// ── Input filters: use inside onChange so invalid characters can never be typed ──
export const filterName   = (v) => v.replace(/[^\p{L}\p{M} '’-]/gu, "");
export const filterDigits = (v, max) => v.replace(/\D/g, "").slice(0, max);
export const filterTc     = (v) => filterDigits(v, 11);
export const filterAge    = (v) => filterDigits(v, 3);
export const filterCaseId = (v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12);

// ── Validators ──
export function validateName(value, label = "This field") {
  const v = (value ?? "").trim();
  if (!v) return `${label} cannot be empty.`;
  if (v.length < 2) return `${label} must be at least 2 characters.`;
  if (!NAME_RE.test(v)) return `${label} can only contain letters.`;
  return null;
}

export function validateEmail(value) {
  const v = (value ?? "").trim();
  if (!v) return "Email cannot be empty.";
  if (!EMAIL_RE.test(v)) return "Please enter a valid email address.";
  return null;
}

/** Registration: at least 8 characters, at least 1 letter and 1 digit. */
export function validateNewPassword(value) {
  const v = value ?? "";
  if (!v) return "Password cannot be empty.";
  if (v.length < 8) return "Password must be at least 8 characters.";
  if (!/\p{L}/u.test(v)) return "Password must contain at least one letter.";
  if (!/\d/.test(v)) return "Password must contain at least one number.";
  return null;
}

export function validateConfirmPassword(value, original) {
  if (!value) return "Please repeat your password.";
  if (value !== original) return "Passwords do not match.";
  return null;
}

function isValidTc(v) {
  const d = v.split("").map(Number);
  const odd  = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth    = (((odd * 7 - even) % 10) + 10) % 10;   // JS % can be negative, Dart's cannot
  const eleventh = d.slice(0, 10).reduce((a, b) => a + b, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

/** T.C. Kimlik No: 11 digits, first digit not 0, last two digits satisfy the checksum algorithm. */
export function validateTc(value) {
  const v = (value ?? "").trim();
  if (!v) return "T.C. Kimlik No cannot be empty.";
  if (!/^[1-9]\d{10}$/.test(v)) return "T.C. Kimlik No must be 11 digits and cannot start with 0.";
  if (!isValidTc(v)) return "Please enter a valid T.C. Kimlik No.";
  return null;
}

export function validateAge(value) {
  const n = parseInt(String(value ?? "").trim(), 10);
  if (Number.isNaN(n)) return "Please enter the age.";
  if (n < 0 || n > 120) return "Please enter a valid age (0–120).";
  return null;
}

export function validateCaseId(value) {
  const v = (value ?? "").trim();
  if (!v) return "Case ID cannot be empty.";
  if (v.length < 4) return "Please enter a valid Case ID.";
  return null;
}

/** First error found in a list of `null | string` results, or null if all passed. */
export const firstError = (...errors) => errors.find(Boolean) ?? null;

export const joinName = (first, last) => `${first.trim()} ${last.trim()}`.trim();

/** Best-effort split of a full name (e.g. from Google) into [first, last]. Last word = surname. */
export function splitFullName(full) {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return [parts[0] ?? "", ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}
