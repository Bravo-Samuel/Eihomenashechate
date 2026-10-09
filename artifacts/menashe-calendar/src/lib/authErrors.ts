export type SignUpErrorKind =
  | "email-exists"
  | "invalid-email"
  | "weak-password"
  | "rate-limited"
  | "signup-disabled"
  | "email-restricted"
  | "captcha-failed"
  | "provider-unavailable"
  | "unknown";

export type SignUpErrorDetails = {
  code?: unknown;
  status?: unknown;
  message?: unknown;
};

export type SignUpDiagnostic = {
  operation: "sign-up";
  type: "provider_rejection" | "request_failure";
  category: SignUpErrorKind | "request-failure";
  message: string;
  code?: string;
  status?: number;
};

const SAFE_ERROR_CODE = /^[a-z0-9_-]{1,64}$/i;

export function classifySignUpError(
  error: SignUpErrorDetails,
): SignUpErrorKind {
  const code =
    typeof error.code === "string" ? error.code.toLowerCase() : "";
  const message =
    typeof error.message === "string" ? error.message.toLowerCase() : "";

  if (
    code === "email_exists" ||
    code === "user_already_exists" ||
    message.includes("already registered") ||
    message.includes("already exists")
  ) {
    return "email-exists";
  }
  if (
    code === "email_address_invalid" ||
    code === "invalid_email" ||
    message.includes("invalid email")
  ) {
    return "invalid-email";
  }
  if (
    code === "weak_password" ||
    (message.includes("password") && message.includes("characters"))
  ) {
    return "weak-password";
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    code === "too_many_requests" ||
    error.status === 429
  ) {
    return "rate-limited";
  }
  if (code === "signup_disabled" || code === "email_provider_disabled") {
    return "signup-disabled";
  }
  if (code === "email_address_not_authorized") {
    return "email-restricted";
  }
  if (code === "captcha_failed" || code === "captcha_verification_failed") {
    return "captcha-failed";
  }
  if (
    code === "unexpected_failure" ||
    (typeof error.status === "number" && error.status >= 500)
  ) {
    return "provider-unavailable";
  }
  return "unknown";
}

export function safeSignUpDiagnostic(
  code: unknown,
  status: unknown,
  message?: unknown,
): SignUpDiagnostic {
  const safeCode =
    typeof code === "string" && SAFE_ERROR_CODE.test(code)
      ? code.toLowerCase()
      : undefined;
  const safeStatus =
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 100 &&
    status <= 599
      ? status
      : undefined;

  return {
    operation: "sign-up",
    type: "provider_rejection",
    category: classifySignUpError({
      code: safeCode,
      status: safeStatus,
      message,
    }),
    message: "Supabase rejected the sign-up request.",
    ...(safeCode ? { code: safeCode } : {}),
    ...(safeStatus ? { status: safeStatus } : {}),
  };
}

export function safeThrownSignUpDiagnostic(
  error: unknown,
): SignUpDiagnostic {
  return {
    operation: "sign-up",
    type: "request_failure",
    category: "request-failure",
    message: "No provider response was received for the sign-up request.",
  };
}
