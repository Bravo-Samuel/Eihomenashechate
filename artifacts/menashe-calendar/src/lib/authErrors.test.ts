import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySignUpError,
  safeSignUpDiagnostic,
  safeThrownSignUpDiagnostic,
} from "./authErrors";

test("classifies common Supabase sign-up rejection codes", () => {
  const cases = [
    ["email_exists", 422, "email-exists"],
    ["user_already_exists", 422, "email-exists"],
    ["email_address_invalid", 400, "invalid-email"],
    ["weak_password", 422, "weak-password"],
    ["over_email_send_rate_limit", 429, "rate-limited"],
    ["signup_disabled", 400, "signup-disabled"],
    ["email_provider_disabled", 400, "signup-disabled"],
    ["email_address_not_authorized", 422, "email-restricted"],
    ["captcha_failed", 400, "captcha-failed"],
    ["unexpected_failure", 500, "provider-unavailable"],
  ] as const;

  for (const [code, status, expected] of cases) {
    assert.equal(classifySignUpError({ code, status }), expected);
  }
});

test("classifies legacy messages and HTTP rate limits", () => {
  assert.equal(
    classifySignUpError({ message: "User already registered" }),
    "email-exists",
  );
  assert.equal(
    classifySignUpError({ message: "Password must contain more characters" }),
    "weak-password",
  );
  assert.equal(classifySignUpError({ status: 429 }), "rate-limited");
});

test("keeps unrecognized provider errors on the generic path", () => {
  assert.equal(
    classifySignUpError({ code: "new_provider_error", status: 400 }),
    "unknown",
  );
});

test("sign-up diagnostics only include validated code and HTTP status", () => {
  assert.deepEqual(
    safeSignUpDiagnostic("EMAIL_ADDRESS_NOT_AUTHORIZED", 422),
    {
      operation: "sign-up",
      code: "email_address_not_authorized",
      status: 422,
    },
  );
  assert.deepEqual(safeSignUpDiagnostic("secret\nvalue", 700), {
    operation: "sign-up",
  });
  assert.deepEqual(safeSignUpDiagnostic(undefined, Number.NaN), {
    operation: "sign-up",
  });
});

test("thrown diagnostics never serialize exception details", () => {
  assert.deepEqual(
    safeThrownSignUpDiagnostic(new TypeError("private request details")),
    {
      operation: "sign-up",
      failure: "thrown",
      errorClass: "TypeError",
    },
  );
  assert.deepEqual(safeThrownSignUpDiagnostic("private value"), {
    operation: "sign-up",
    failure: "thrown",
    errorClass: "Unknown",
  });
});
