// Validation helpers. Kept dependency-free and pure so they're easy
// for a reviewer (or a cybersecurity-minded reader) to audit in full.

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Deliberately conservative: 8+ chars, at least one letter and one digit.
// This is NOT a substitute for a breached-password check (e.g. HaveIBeenPwned
// k-anonymity API) — add one before using this for anything real.
function isStrongEnoughPassword(pw) {
  return typeof pw === "string" && pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
}

// Standard mod-10 Luhn checksum — catches typos and obviously-fake
// numbers. It does NOT verify the card is real, funded, or not stolen;
// only a real payment gateway can do that.
function luhnCheck(numberStr) {
  const digits = String(numberStr).replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Rough brand detection from IIN ranges, including Verve (the common
// Nigerian domestic scheme) alongside the usual international ones.
function detectCardBrand(numberStr) {
  const digits = String(numberStr).replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|22[2-9]|2[3-6]\d|27[01]\d|2720)/.test(digits)) return "Mastercard";
  if (/^(506[01]\d{2}|6500(0[2-9]|1\d|2[0-7]))/.test(digits)) return "Verve";
  if (/^3[47]/.test(digits)) return "American Express";
  return "Card";
}

function last4(numberStr) {
  const digits = String(numberStr).replace(/\D/g, "");
  return digits.slice(-4);
}

function isFutureExpiry(month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!m || !y || m < 1 || m > 12) return false;
  const normalizedYear = y < 100 ? 2000 + y : y;
  const now = new Date();
  const expiry = new Date(normalizedYear, m, 0, 23, 59, 59); // last day of that month
  return expiry >= now;
}

module.exports = {
  isValidEmail,
  isStrongEnoughPassword,
  luhnCheck,
  detectCardBrand,
  last4,
  isFutureExpiry,
};
