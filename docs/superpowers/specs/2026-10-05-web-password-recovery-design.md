# Web Calendar Password Recovery

**Status:** Design approved; awaiting written-spec review
**Date:** 2026-10-05

## Context

The web calendar uses Supabase Auth. Its existing sign-in form supports email and
password, but it has no password-recovery route. The Expo app uses a separate
Clerk authentication flow and already has a recovery screen; this change is
limited to the web calendar.

The web app already provides a shared Menashe authentication card, bilingual
English and Thadou Kuki copy, Supabase URL-session detection, and explicit
sign-in/sign-up routes. Recovery should reuse those conventions and must not be
hidden behind the global startup splash.

## Goals

- Let a user request an account-recovery email from the web sign-in page.
- Let the user set a new password after following a valid Supabase recovery link.
- Handle invalid and expired links without exposing account data or leaving the
  user without a recovery path.
- Keep the web and mobile providers separate; do not change the Clerk mobile
  flow.

## Decisions

### Recovery method

Use Supabase's email-link recovery flow rather than an in-app email-code form.
The sign-in page links to `/forgot-password`. That page calls
`supabase.auth.resetPasswordForEmail` with a same-origin redirect to
`/reset-password`. Supabase's existing URL-session detection handles the link
callback.

The Supabase recovery email template and Auth redirect allowlist must permit the
calendar's `/reset-password` URL for each environment where recovery is expected
to work. Do not hardcode a development host or expose any privileged key in the
browser.

### Requesting a recovery link

- Add a “Forgot password?” link to the web sign-in form.
- `/forgot-password` accepts an email address and shows loading, success, and
  recoverable error states.
- After a request, use generic confirmation copy such as “If an account exists
  for that address, check your email.” Do not reveal whether an address is
  registered.
- Normalize and trim the submitted email consistently with sign-in.
- Include a link back to sign-in.

### Setting a new password

- `/reset-password` renders the recovery form only when Supabase has established
  an active session from the recovery flow.
- Require a new password and confirmation. Match the existing account-creation
  minimum of eight characters and reject mismatched values before submission.
- Call Supabase Auth's `updateUser` with the new password. On success, end the
  recovery session and show a confirmation with a sign-in link.
- If the recovery link is invalid, expired, or already used, show a clear
  message and a way to request another link. Do not show the password form
  without an active session.
- Keep tokens and provider error details out of user-visible copy and logs.

### Routes and presentation

- Add `/forgot-password` and `/reset-password` to the web router and render them
  in the existing `AuthCard`.
- Ensure both recovery routes bypass startup/onboarding overlays just like
  `/sign-in` and `/sign-up`.
- Use the existing auth field, button, confirmation, and error styles. Preserve
  overflow-safe scrolling on small viewports.
- Add every new user-facing string to the English and Thadou Kuki auth copy.

## Error handling

- Show a generic retry message if Supabase cannot send the email; do not
  distinguish unknown addresses from provider failures in the success state.
- Keep the request form usable after a transient failure.
- On an expired/invalid link, offer a route back to `/forgot-password`.
- On a failed password update, preserve the form values where safe, show a
  localized actionable error, and allow retry.
- Disable submit actions while requests are in progress and expose status/error
  changes with accessible live regions.

## Verification

- Typecheck and production-build the web calendar.
- Verify the sign-in link, forgot-password submission, generic confirmation,
  and return-to-sign-in navigation in both supported languages.
- With a configured Supabase test account, verify the recovery email points to
  the same-origin reset route and the new password works on the next sign-in.
- Verify expired/invalid links cannot show or submit the password form.
- Verify too-short and mismatched passwords are rejected and a successful
  password update ends at the sign-in confirmation state.
- Confirm the mobile Clerk recovery flow remains unchanged.

## Relevant code

- `artifacts/menashe-calendar/src/auth.tsx`
- `artifacts/menashe-calendar/src/App.tsx`
- `artifacts/menashe-calendar/src/index.css`
- `artifacts/menashe-calendar/src/lib/supabase.ts`
- `artifacts/menashe-mobile/app/forgot-password.tsx` (reference only; unchanged)
