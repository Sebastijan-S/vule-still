import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHALLENGE_SECONDS,
  authErrorMessage,
  normalizeCode,
  normalizeEmail,
  normalizePhone,
  parseChallenge,
  safeReturnTo,
  validName,
} from "../src/lib/auth/validation.ts";

test("return destinations stay on approved local routes", () => {
  assert.equal(safeReturnTo("/rezervacija?lokacija=neuzin#termin"), "/rezervacija?lokacija=neuzin#termin");
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/admin", "/profil\nLocation: https://evil.example", "javascript:alert(1)"]) {
    assert.equal(safeReturnTo(value), "/moji-termini");
  }
});

test("email and OTP fields reject malformed values", () => {
  assert.equal(normalizeEmail("  Example@Example.COM "), "example@example.com");
  assert.equal(normalizeEmail("no-at-sign"), null);
  assert.equal(normalizeCode(" 123 456 "), "123456");
  assert.equal(normalizeCode("12345"), null);
  assert.equal(normalizeCode("12345x"), null);
});

test("challenge expires at the exact ten-minute boundary", () => {
  const now = 1_000_000;
  const raw = JSON.stringify({ email: "a@example.com", sentAt: now - CHALLENGE_SECONDS * 1000 + 1 });
  assert.ok(parseChallenge(raw, now));
  assert.equal(parseChallenge(raw, now + 1), null);
  assert.equal(parseChallenge(JSON.stringify({ email: "a@example.com", sentAt: now + 1 }), now), null);
});

test("provider OTP failures get a safe retry message", () => {
  for (const code of ["otp_expired", "otp_disabled", "invalid_credentials"]) {
    assert.match(authErrorMessage({ code }, true), /Kod nije ispravan ili je istekao/);
  }
  assert.match(authErrorMessage({ status: 429 }, true), /Previše pokušaja/);
  assert.match(authErrorMessage({ code: "over_email_send_rate_limit", status: 429 }), /limit slanja imejlova za ceo sajt/);
});

test("profile input normalizes supported phones and rejects invalid data", () => {
  assert.equal(normalizePhone("064 123 4567"), "+381641234567");
  assert.equal(normalizePhone("+381 64 123 4567"), "+381641234567");
  assert.equal(normalizePhone("1234567"), null);
  assert.equal(normalizePhone("+381 abc"), null);
  assert.equal(validName("Ana"), true);
  assert.equal(validName("  "), false);
  assert.equal(validName("\n"), false);
});
