// Shared form helpers: T.C. Kimlik No, Case ID, random Case ID generation

export const tcFormat = (value) =>
  String(value ?? "").replace(/\D/g, "").slice(0, 11);

/** Returns an error message, or null when the T.C. Kimlik No is valid. */
export const validateTc = (value) => {
  const tc = String(value ?? "").trim();

  if (!tc) return "T.C. Kimlik No is required.";

  if (!/^[1-9]\d{10}$/.test(tc)) {
    return "T.C. Kimlik No must have 11 digits and cannot start with 0.";
  }

  const digits = tc.split("").map(Number);

  const odd  = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];

  const tenth    = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;

  if (digits[9] !== tenth || digits[10] !== eleventh) {
    return "Please enter a valid T.C. Kimlik No.";
  }

  return null;
};

export const caseIdFormat = (value) =>
  String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();

/** Returns an error message, or null when the Case ID looks valid. */
export const validateCaseId = (value) => {
  const caseId = String(value ?? "").trim();

  if (!caseId) return "Case ID is required.";
  if (caseId.length < 4) return "Please enter a valid Case ID.";

  return null;
};

// 32 characters without the look-alikes I, O, 0, 1  (256 % 32 === 0 -> no modulo bias)
const CASE_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Cryptographically random Case ID, e.g. "C7K2M9QX" (8 characters, 32^7 combinations).
 * Case IDs are the second secret a patient needs to link a case, so they must not be guessable
 * (the old Date.now()-based IDs were sequential).
 */
export function generateCaseId(length = 8) {
  const bytes = new Uint8Array(length - 1);
  crypto.getRandomValues(bytes);
  return "C" + Array.from(bytes, (b) => CASE_ID_ALPHABET[b % CASE_ID_ALPHABET.length]).join("");
}

/** Returns an error message, or null when the password is valid. */
export const validateNewPassword = (password) => {
  if (!password) return "New password is required.";
  if (password.length < 8) return "Password must be at least 8 characters long.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
};

/** Returns an error message, or null when passwords match. */
export const validateConfirmPassword = (confirm, password) => {
  if (!confirm) return "Please confirm your password.";
  if (confirm !== password) return "Passwords do not match.";
  return null;
};

// /** Takes multiple validation results and returns the first non-null error message, or null. */
// export const firstError = (...errors) => {
//   return errors.find((err) => err !== null && err !== undefined) || null;
// };

/** Takes multiple validation results and returns the first non-null error message, or null. */
export const firstError = (...errors) => {
  return errors.find((err) => err !== null && err !== undefined) || null;
};

/** Filters name input to allow letters (including Turkish), spaces, hyphens, and apostrophes. */
export const filterName = (value) => {
  return String(value ?? "").replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ\s'-]/g, "");
};

/** Validates a first or last name. */
export const validateName = (value, fieldName = "Name") => {
  const name = String(value ?? "").trim();
  if (!name) return `${fieldName} is required.`;
  if (name.length < 2) return `${fieldName} must be at least 2 characters long.`;
  return null;
};

/** Joins first and last name nicely with a space. */
export const joinName = (firstName, lastName) => {
  return [firstName, lastName].map(n => String(n ?? "").trim()).filter(Boolean).join(" ");
};

/** Returns an error message, or null when the email is valid. */
export const validateEmail = (email) => {
  const value = String(email ?? "").trim();
  if (!value) return "Email address is required.";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) return "Please enter a valid email address.";
  return null;
};