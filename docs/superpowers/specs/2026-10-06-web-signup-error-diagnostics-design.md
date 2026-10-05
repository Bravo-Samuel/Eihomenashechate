# Web Calendar Sign-up Error Diagnostics

**Status:** Design approved; awaiting written-spec review
**Date:** 2026-10-06

## Context

The web calendar submits sign-up directly to Supabase Auth from the browser.
Unknown Supabase errors are reduced to generic copy, and thrown failures use
the same fallback. The API server therefore has no sign-up request to inspect,
and the screenshot does not expose the underlying provider error. The cause
has not yet been identified.

The Expo app uses a separate Clerk flow. This work is limited to web sign-up.

## Goals

- Record enough safe diagnostic information in development to identify the
  Supabase failure category on a retry.
- Give recognized sign-up failures localized, actionable copy while retaining
  generic copy for unknown failures.
- Keep provider details, user data, and credentials out of logs and the UI.
- Leave successful sign-up, email-confirmation, and mobile authentication
  behavior unchanged.

## Design

### Diagnostic capture

- Capture diagnostics at the web `signUp` call boundary, where both returned
  Supabase errors and thrown failures can be observed.
- Emit diagnostics only when the Vite development flag is enabled.
- For returned Supabase errors, log only the operation name, a provider error
  code that matches `^[a-z0-9_-]{1,64}$` (case-insensitive), and a numeric HTTP
  status.
- For thrown failures, record only that the failure was thrown and, when it is
  a built-in `Error`, its fixed error class (`Error` or `TypeError`); do not
  serialize the exception.
- Never log the error message, email, password, tokens, response body, or
  request headers.
- Do not add a server endpoint or change Supabase project settings.

### User-visible errors

- Classify recognized Supabase sign-up codes/statuses through a pure helper so
  the mappings can be tested without calling Supabase.
- Reuse the existing English and Thadou Kuki auth-copy structure for any
  targeted messages.
- Keep the current generic fallback for unrecognized errors and thrown
  failures. Never display raw provider messages.
- Preserve current confirmation handling and existing recognized copy.

### Scope

- Change only the web calendar's sign-up error handling and its focused tests.
- Do not change sign-in, password recovery, API auth routes, Supabase
  configuration, or the Expo/Clerk flow.
- If diagnostics identify a Supabase dashboard or email-provider configuration
  issue, report the evidence before changing external settings.

## Verification

- Test the pure error classifier for recognized codes/statuses and unknown
  fallbacks.
- Verify the development diagnostic contains only allowlisted fields and is
  disabled in production mode.
- Run the web calendar typecheck, test suite, and production build.
- Do not create a real Supabase account as part of automated verification.
- Ask the user to retry sign-up in the development preview and share only the
  resulting code/status if the failure remains.
