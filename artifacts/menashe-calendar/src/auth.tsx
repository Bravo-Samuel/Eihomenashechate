import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { useLanguage } from "./context/LanguageContext";
import { supabase } from "./lib/supabase";

export type AuthUser = {
  id: string;
  subject: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  imageUrl?: string;
  createdAt: string;
  publicMetadata: { isAdmin?: boolean };
  emailAddresses: Array<{ emailAddress: string }>;
};

type AuthActionResult = {
  error: string | null;
  requiresConfirmation?: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoaded: boolean;
  status: AuthStatus;
  authError: "unavailable" | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  requestPasswordReset: (email: string) => Promise<AuthActionResult>;
  updatePassword: (password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "unavailable";

const AuthContext = createContext<AuthContextValue | null>(null);

function requireAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("Auth hooks must be used inside SupabaseAuthProvider");
  }
  return context;
}

function getPasswordResetRedirectUrl(): string {
  const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL("reset-password", appBaseUrl).toString();
}

function mapUser(body: {
  id: string;
  subject: string;
  email: string | null;
  name: string;
  imageUrl: string | null;
  isAdmin: boolean;
  createdAt?: string;
}): AuthUser {
  const nameParts = body.name.trim().split(/\s+/);
  return {
    id: body.id,
    subject: body.subject,
    email: body.email,
    firstName: nameParts[0] || null,
    lastName: nameParts.slice(1).join(" ") || null,
    fullName: body.name,
    imageUrl: body.imageUrl ?? undefined,
    createdAt: body.createdAt ?? new Date().toISOString(),
    publicMetadata: { isAdmin: body.isAdmin },
    emailAddresses: body.email ? [{ emailAddress: body.email }] : [],
  };
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<"unavailable" | null>(null);

  const syncSession = useCallback(async (
    session: Session | null,
  ): Promise<AuthStatus> => {
    if (!session) {
      setUser(null);
      setStatus("signed-out");
      setAuthError(null);
      setIsLoaded(true);
      return "signed-out";
    }

    setStatus("loading");
    setAuthError(null);
    try {
      const response = await fetch("/api/auth/user", {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (response.status === 401) {
        setUser(null);
        setStatus("signed-out");
        return "signed-out";
      }
      if (response.status === 401) {
      setUser(null);
      setStatus("signed-out");
      setAuthError(null);
      return "signed-out";
    }

    if (!response.ok) {
        throw new Error(`Auth check failed with ${response.status}`);
      }
      const body = (await response.json()) as {
        user?: Parameters<typeof mapUser>[0];
      };
      if (!body.user) {
        setUser(null);
        setStatus("signed-out");
        return "signed-out";
      }
      setUser(mapUser(body.user));
      setStatus("signed-in");
      return "signed-in";
    } catch {
      setUser(null);
      setAuthError("unavailable");
      setStatus("unavailable");
      return "unavailable";
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const refresh = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) {
      setUser(null);
      setAuthError("unavailable");
      setStatus("unavailable");
      setIsLoaded(true);
      return;
    }
    await syncSession(session);
  }, [syncSession]);

  useEffect(() => {
    void refresh();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });
    return () => subscription.unsubscribe();
  }, [refresh, syncSession]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) return { error: error?.message ?? null };
      const result = await syncSession(data.session);
      return {
        error:
          result === "unavailable" ? "migration_unavailable" : null,
      };
    },
    [syncSession],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthActionResult> => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (!error && data.session) {
        const result = await syncSession(data.session);
        if (result === "unavailable") {
          return { error: "migration_unavailable" };
        }
      }
      return {
        error: error?.message ?? null,
        requiresConfirmation: !error && !data.session,
      };
    },
    [syncSession],
  );

  const requestPasswordReset = useCallback(
    async (email: string): Promise<AuthActionResult> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getPasswordResetRedirectUrl(),
      });
      return { error: error?.message ?? null };
    },
    [],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<AuthActionResult> => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session) {
        return { error: "recovery_session_required" };
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: error.message };

      await supabase.auth.signOut({ scope: "local" });
      return { error: null };
    },
    [],
  );

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setStatus("signed-out");
      window.location.assign("/");
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoaded,
      status,
      authError,
      refresh,
      signIn,
      signUp,
      requestPasswordReset,
      updatePassword,
      signOut,
    }),
    [
      authError,
      isLoaded,
      refresh,
      requestPasswordReset,
      signIn,
      signOut,
      signUp,
      status,
      updatePassword,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useUser(): {
  user: AuthUser | null;
  isLoaded: boolean;
} {
  const { user, isLoaded } = requireAuthContext();
  return { user, isLoaded };
}

export function useAuthState(): {
  status: AuthStatus;
  authError: "unavailable" | null;
  retry: () => Promise<void>;
} {
  const { status, authError, refresh } = requireAuthContext();
  return { status, authError, retry: refresh };
}

export function useOrganization(): {
  membership: { role: string } | null;
} {
  const { user } = requireAuthContext();
  return {
    membership: user?.publicMetadata.isAdmin
      ? { role: "org:admin" }
      : null,
  };
}

export function useAuthActions(): {
  signOut: (options?: { redirectUrl?: string }) => Promise<void>;
} {
  return { signOut: requireAuthContext().signOut };
}

export function Show({
  when,
  children,
}: {
  when: "signed-in" | "signed-out";
  children: ReactNode;
}) {
  const { user, isLoaded, status } = requireAuthContext();
  if (!isLoaded) return null;
  if (when === "signed-in" && user) return <>{children}</>;
  if (when === "signed-out" && !user && status === "signed-out") {
    return <>{children}</>;
  }
  return null;
}

const authCopy = {
  en: {
    signInEyebrow: "PERSONAL CALENDAR · COMMUNITY",
    signInTitle: "Welcome back",
    signInBody: "Your calendar, learning, and community life in one place.",
    forgotPasswordLink: "Forgot password?",
    signInButton: "Sign in",
    signInBusy: "Signing in…",
    signUpEyebrow: "BEGIN YOUR JOURNEY",
    signUpTitle: "Join Bnei Menashe",
    signUpBody:
      "Create your free account to save your calendar and take part in the community.",
    signUpButton: "Create account",
    signUpBusy: "Creating account…",
    emailLabel: "Email address",
    emailPlaceholder: "you@example.com",
    emailRequired: "Enter your email address.",
    emailInvalid: "Enter a valid email address.",
    passwordLabel: "Password",
    confirmPasswordLabel: "Confirm password",
    newMember: "New to Bnei Menashe?",
    existingMember: "Already have an account?",
    createAccount: "Create an account",
    signInLink: "Sign in",
    back: "Back to calendar",
    secure: "Secure authentication · Your password is never visible to MENASHE",
    nextTitle: "What happens next",
    nextSteps: [
      "Enter your email and password",
      "Supabase verifies your account securely",
      "Continue to your MENASHE calendar",
    ],
    previewTitle: "Testing in Preview?",
    previewBody:
      "Use a private window if you need to test with a different Supabase account.",
    expired: "That sign-in session has expired. Please sign in again.",
    invalid: "We couldn't verify that sign-in attempt. Please try again.",
    cancelled: "Sign-in was cancelled. You can try again whenever you're ready.",
    provider: "Supabase authentication is temporarily unavailable. Please try again.",
    unavailable: "We couldn't start sign-in right now. Please try again.",
    required: "Enter your email address and password.",
    passwordMismatch: "The passwords do not match.",
    passwordTooShort: "Use at least 8 characters for your password.",
    invalidCredentials: "The email address or password is incorrect.",
    emailExists: "An account with this email address already exists.",
    genericError: "We couldn't complete that request. Please try again.",
    confirmationTitle: "Check your email",
    confirmationBody:
      "Supabase sent a confirmation link to your email address. Confirm it, then return here to sign in.",
    recoveryEyebrow: "ACCOUNT RECOVERY",
    forgotPasswordTitle: "Reset your password",
    forgotPasswordBody:
      "Enter the email address linked to your account and we'll send a secure recovery link.",
    sendRecoveryLink: "Send recovery link",
    sendingRecoveryLink: "Sending link…",
    recoveryEmailSentTitle: "Check your email",
    recoveryEmailSentBody:
      "If an account exists for that address, a recovery link is on its way. Check your inbox and spam folder.",
    recoveryEmailError:
      "We couldn't send the recovery email right now. Please try again.",
    resetPasswordTitle: "Choose a new password",
    resetPasswordBody: "Create a new password for your MENASHE account.",
    newPasswordLabel: "New password",
    confirmNewPasswordLabel: "Confirm new password",
    saveNewPassword: "Save new password",
    savingNewPassword: "Updating password…",
    recoveryChecking: "Checking your recovery link…",
    recoveryExpiredTitle: "Recovery link unavailable",
    recoveryExpiredBody:
      "This link is invalid, expired, or already used. Request a new recovery link to continue.",
    requestAnotherRecoveryLink: "Request another link",
    passwordUpdatedTitle: "Password updated",
    passwordUpdatedBody:
      "Your password has been changed. Sign in with your new password.",
    passwordUpdateError: "We couldn't update your password. Please try again.",
    recoverySessionRequired:
      "This recovery link is invalid or has expired. Request a new link.",
  },
  tk: {
    signInEyebrow: "ŞAHSY SENENAMA · JEMGYÝET",
    signInTitle: "Hoş geldiňiz",
    signInBody: "Senenamaňyz, öwrenişiňiz we jemgyýet durmuşyňyz bir ýerde.",
    forgotPasswordLink: "Password ka thei lo?",
    signInButton: "Giriň",
    signInBusy: "Giriş edilýär…",
    signUpEyebrow: "SYÝAHATYŇYZY BAŞLAŇ",
    signUpTitle: "Bnei Menashe-e goşulyň",
    signUpBody:
      "Senenamaňyzy ýatda saklamak we jemgyýete goşulmak üçin mugt hasap dörediň.",
    signUpButton: "Hasap dörediň",
    signUpBusy: "Hasap döredilýär…",
    emailLabel: "E-poçta salgysy",
    emailPlaceholder: "siz@example.com",
    emailRequired: "Email address ziak rawh.",
    emailInvalid: "Email address dik ziak rawh.",
    passwordLabel: "Parol",
    confirmPasswordLabel: "Paroly tassyklaň",
    newMember: "Bnei Menashe-de täzemi?",
    existingMember: "Hasabyňyz barmy?",
    createAccount: "Hasap dörediň",
    signInLink: "Giriň",
    back: "Senenama dolan",
    secure: "Howpsuz giriş · Parolyňyz MENASHE-e görünmeýär",
    nextTitle: "Indi näme bolar",
    nextSteps: [
      "E-poçtaňyzy we parolyňyzy ýazyň",
      "Supabase hasabyňyzy howpsuz tassyklar",
      "MENASHE senenamaňyza geçiň",
    ],
    previewTitle: "Preview-de synaýarsyňyzmy?",
    previewBody:
      "Başga Supabase hasaby bilen synag üçin gizlin penjiräni ulanyň.",
    expired: "Giriş sessiýasynyň möhleti gutardy. Täzeden giriň.",
    invalid: "Giriş synanyşygyňyzy tassyklap bilmedik. Täzeden synanyşyň.",
    cancelled: "Giriş ýatyryldy. Taýýar bolanyňyzda täzeden synanyşyň.",
    provider: "Supabase girişi wagtlaýyn elýeterli däl. Täzeden synanyşyň.",
    unavailable: "Häzir giriş başlap bilmedik. Täzeden synanyşyň.",
    required: "E-poçta salgyňyzy we parolyňyzy ýazyň.",
    passwordMismatch: "Parollar gabat gelenok.",
    passwordTooShort: "Parolyňyz azyndan 8 belgiden ybarat bolsun.",
    invalidCredentials: "E-poçta salgysy ýa-da parol nädogry.",
    emailExists: "Bu e-poçta salgysy bilen hasap eýýäm bar.",
    genericError: "Talaby ýerine ýetirip bilmedik. Täzeden synanyşyň.",
    confirmationTitle: "E-poçtaňyzy barlaň",
    confirmationBody:
      "Supabase e-poçtaňyza tassyklama baglanyşygyny iberdi. Ony tassyklaň, soň giriş üçin bu ýere dolanyň.",
    recoveryEyebrow: "ACCOUNT RECOVERY",
    forgotPasswordTitle: "Password thar siam",
    forgotPasswordBody:
      "Na account email address ziak rawh; recovery link i email ah thawn ding.",
    sendRecoveryLink: "Recovery link thawn",
    sendingRecoveryLink: "Link thawn mek…",
    recoveryEmailSentTitle: "Email en rawh",
    recoveryEmailSentBody:
      "Account a awm a leh recovery link email ah thawn ding. Inbox leh spam en rawh.",
    recoveryEmailError:
      "Recovery email thawn thei lo. Manin siam leh rawh.",
    resetPasswordTitle: "Password thar siam",
    resetPasswordBody: "Na MENASHE account tan password thar siam rawh.",
    newPasswordLabel: "Password thar",
    confirmNewPasswordLabel: "Password thar confirm",
    saveNewPassword: "Password thar save",
    savingNewPassword: "Password siam mek…",
    recoveryChecking: "Recovery link en mek…",
    recoveryExpiredTitle: "Recovery link a hun tawp ta",
    recoveryExpiredBody:
      "Link hi dik lo, hun a tawp, emaw hman zo ta. Link thar request siam rawh.",
    requestAnotherRecoveryLink: "Link thar request",
    passwordUpdatedTitle: "Password thar siam zo",
    passwordUpdatedBody:
      "Na password thar siam zo. Password thar hmangin sign in siam rawh.",
    passwordUpdateError: "Password update thei lo. Manin siam leh rawh.",
    recoverySessionRequired:
      "Recovery link hi dik lo emaw hun a tawp ta. Link thar request siam rawh.",
  },
} as const;

type AuthCopy = {
  [Key in keyof (typeof authCopy)["en"]]: (typeof authCopy)["en"][Key] extends
    readonly string[]
    ? readonly string[]
    : string;
};

type AuthErrorCode = keyof Pick<
  typeof authCopy.en,
  "expired" | "invalid" | "cancelled" | "provider" | "unavailable"
>;

function useAuthPageContext() {
  const { lang } = useLanguage();
  const query = new URLSearchParams(window.location.search);
  const rawReturnTo = query.get("returnTo");
  const returnTo = safeReturnTo(rawReturnTo, "/app");
  const rawError = query.get("authError");
  const errorCode: AuthErrorCode | null =
    rawError === "expired" ||
    rawError === "invalid" ||
    rawError === "cancelled" ||
    rawError === "provider" ||
    rawError === "unavailable"
      ? rawError
      : null;
  const preview =
    import.meta.env.DEV &&
    (import.meta.env.VITE_DEV_PREVIEW === "true" ||
      query.get("preview") === "1");
  return { copy: authCopy[lang], returnTo, errorCode, preview };
}

function safeReturnTo(raw: string | null, fallback: string): string {
  if (!raw || !raw.startsWith("/") || raw.includes("\\")) return fallback;
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.origin !== window.location.origin) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function friendlyAuthError(message: string, copy: AuthCopy): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("migration_unavailable")) return copy.provider;
  if (
    normalized.includes("invalid login credentials") ||
    normalized.includes("invalid credentials")
  ) {
    return copy.invalidCredentials;
  }
  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists")
  ) {
    return copy.emailExists;
  }
  if (normalized.includes("password") && normalized.includes("characters")) {
    return copy.passwordTooShort;
  }
  return copy.genericError;
}

function AuthForm({
  mode,
  copy,
  returnTo,
}: {
  mode: "sign-in" | "sign-up";
  copy: AuthCopy;
  returnTo: string;
}) {
  const { signIn, signUp } = requireAuthContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError(copy.required);
      return;
    }
    if (mode === "sign-up" && password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (mode === "sign-up" && password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === "sign-in"
          ? await signIn(normalizedEmail, password)
          : await signUp(normalizedEmail, password);
      if (result.error) {
        setError(friendlyAuthError(result.error, copy));
        return;
      }
      if (result.requiresConfirmation) {
        setConfirmationSent(true);
        return;
      }
      window.location.assign(returnTo);
    } catch {
      setError(copy.genericError);
    } finally {
      setBusy(false);
    }
  };

  if (confirmationSent) {
    return (
      <div className="auth-confirmation" role="status" aria-live="polite">
        <div className="auth-confirmation-mark" aria-hidden="true">✓</div>
        <strong>{copy.confirmationTitle}</strong>
        <p>{copy.confirmationBody}</p>
      </div>
    );
  }

  return (
    <form className="auth-fields" onSubmit={submit} noValidate>
      <label className="auth-field">
        <span>{copy.emailLabel}</span>
        <input
          className="auth-input"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder={copy.emailPlaceholder}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy}
          required
        />
      </label>
      <label className="auth-field">
        <span>{copy.passwordLabel}</span>
        <input
          className="auth-input"
          type="password"
          name="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={busy}
          minLength={mode === "sign-up" ? 8 : undefined}
          required
        />
      </label>
      {mode === "sign-in" && (
        <a
          className="auth-forgot-link"
          href={`/forgot-password?returnTo=${encodeURIComponent(returnTo)}`}
        >
          {copy.forgotPasswordLink}
        </a>
      )}
      {mode === "sign-up" && (
        <label className="auth-field">
          <span>{copy.confirmPasswordLabel}</span>
          <input
            className="auth-input"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            minLength={8}
            required
          />
        </label>
      )}
      {error && (
        <div role="alert" className="auth-error">
          {error}
        </div>
      )}
      <button
        className="mds-btn-gold auth-cta"
        type="submit"
        disabled={busy}
        aria-busy={busy}
      >
        {busy
          ? mode === "sign-in"
            ? copy.signInBusy
            : copy.signUpBusy
          : mode === "sign-in"
            ? copy.signInButton
            : copy.signUpButton}
      </button>
    </form>
  );
}

export function ForgotPassword() {
  const { copy, returnTo } = useAuthPageContext();
  const { requestPasswordReset } = requireAuthContext();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const signInHref = `/sign-in?returnTo=${encodeURIComponent(returnTo)}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(copy.emailRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError(copy.emailInvalid);
      return;
    }

    setBusy(true);
    try {
      const result = await requestPasswordReset(normalizedEmail);
      if (result.error) {
        setError(copy.recoveryEmailError);
        return;
      }
      setSent(true);
    } catch {
      setError(copy.recoveryEmailError);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-form-content">
        <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
        <h2 className="auth-title">{copy.recoveryEmailSentTitle}</h2>
        <div className="auth-confirmation" role="status" aria-live="polite">
          <div className="auth-confirmation-mark" aria-hidden="true">✓</div>
          <p>{copy.recoveryEmailSentBody}</p>
        </div>
        <a href={signInHref} className="auth-back">
          {copy.signInLink}
        </a>
      </div>
    );
  }

  return (
    <div className="auth-form-content">
      <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
      <h2 className="auth-title">{copy.forgotPasswordTitle}</h2>
      <p className="auth-description">{copy.forgotPasswordBody}</p>
      <form className="auth-fields" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>{copy.emailLabel}</span>
          <input
            className="auth-input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            placeholder={copy.emailPlaceholder}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={busy}
            required
          />
        </label>
        {error && (
          <div role="alert" className="auth-error">
            {error}
          </div>
        )}
        <button
          className="mds-btn-gold auth-cta"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? copy.sendingRecoveryLink : copy.sendRecoveryLink}
        </button>
      </form>
      <a href={signInHref} className="auth-back">
        {copy.signInLink}
      </a>
    </div>
  );
}

export function ResetPassword() {
  const { copy } = useAuthPageContext();
  const { updatePassword } = requireAuthContext();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    let active = true;
    const checkSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (active) setHasSession(!sessionError && Boolean(session));
      } catch {
        if (active) setHasSession(false);
      }
    };

    void checkSession();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(Boolean(session));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (password.length < 8) {
      setError(copy.passwordTooShort);
      return;
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch);
      return;
    }

    setBusy(true);
    try {
      const result = await updatePassword(password);
      if (result.error === "recovery_session_required") {
        setHasSession(false);
        setError(copy.recoverySessionRequired);
        return;
      }
      if (result.error) {
        setError(copy.passwordUpdateError);
        return;
      }
      setComplete(true);
    } catch {
      setError(copy.passwordUpdateError);
    } finally {
      setBusy(false);
    }
  };

  if (complete) {
    return (
      <div className="auth-form-content">
        <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
        <h2 className="auth-title">{copy.passwordUpdatedTitle}</h2>
        <div className="auth-confirmation" role="status" aria-live="polite">
          <div className="auth-confirmation-mark" aria-hidden="true">✓</div>
          <p>{copy.passwordUpdatedBody}</p>
        </div>
        <a href="/sign-in" className="auth-back">
          {copy.signInLink}
        </a>
      </div>
    );
  }

  if (hasSession === null) {
    return (
      <div className="auth-form-content">
        <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
        <div className="auth-confirmation" role="status" aria-live="polite">
          {copy.recoveryChecking}
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="auth-form-content">
        <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
        <h2 className="auth-title">{copy.recoveryExpiredTitle}</h2>
        <p className="auth-description">{copy.recoveryExpiredBody}</p>
        <a href="/forgot-password" className="auth-cta mds-btn-gold auth-action-link">
          {copy.requestAnotherRecoveryLink}
        </a>
        <a href="/sign-in" className="auth-back">
          {copy.signInLink}
        </a>
      </div>
    );
  }

  return (
    <div className="auth-form-content">
      <div className="auth-eyebrow">{copy.recoveryEyebrow}</div>
      <h2 className="auth-title">{copy.resetPasswordTitle}</h2>
      <p className="auth-description">{copy.resetPasswordBody}</p>
      <form className="auth-fields" onSubmit={submit} noValidate>
        <label className="auth-field">
          <span>{copy.newPasswordLabel}</span>
          <input
            className="auth-input"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
          />
        </label>
        <label className="auth-field">
          <span>{copy.confirmNewPasswordLabel}</span>
          <input
            className="auth-input"
            type="password"
            name="confirmNewPassword"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            required
          />
        </label>
        {error && (
          <div role="alert" className="auth-error">
            {error}
          </div>
        )}
        <button
          className="mds-btn-gold auth-cta"
          type="submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? copy.savingNewPassword : copy.saveNewPassword}
        </button>
      </form>
    </div>
  );
}

function AuthGuidance({
  copy,
  preview,
}: {
  copy: AuthCopy;
  preview: boolean;
}) {
  return (
    <div className="auth-guidance-wrap">
      <div className="mds-card-secondary auth-guidance">
        <div className="auth-guidance-title">{copy.nextTitle}</div>
        <ol className="auth-guidance-list">
          {copy.nextSteps.map((step, index) => (
            <li key={step} className="auth-guidance-step">
              <span aria-hidden="true" className="auth-guidance-number">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      {preview && (
        <div role="note" className="auth-preview-note">
          <strong>{copy.previewTitle}</strong>
          {copy.previewBody}
        </div>
      )}
    </div>
  );
}

export function SignIn(_props?: Record<string, unknown>) {
  const { copy, returnTo, errorCode, preview } = useAuthPageContext();
  return (
    <div className="auth-form-content">
      <div className="auth-eyebrow">{copy.signInEyebrow}</div>
      <h2 className="auth-title">{copy.signInTitle}</h2>
      <p className="auth-description">{copy.signInBody}</p>
      {errorCode && (
        <div role="alert" className="auth-error">
          {copy[errorCode]}
        </div>
      )}
      <AuthForm mode="sign-in" copy={copy} returnTo={returnTo} />
      <div className="auth-secure">{copy.secure}</div>
      <AuthGuidance copy={copy} preview={preview} />
      <div className="auth-switch">
        {copy.newMember}{" "}
        <a href={`/sign-up?returnTo=${encodeURIComponent(returnTo)}`}>
          {copy.createAccount}
        </a>
      </div>
      <a href="/" className="auth-back">{copy.back}</a>
    </div>
  );
}

export function SignUp(_props?: Record<string, unknown>) {
  const { copy, returnTo, errorCode, preview } = useAuthPageContext();
  return (
    <div className="auth-form-content">
      <div className="auth-eyebrow">{copy.signUpEyebrow}</div>
      <h2 className="auth-title">{copy.signUpTitle}</h2>
      <p className="auth-description">{copy.signUpBody}</p>
      {errorCode && (
        <div role="alert" className="auth-error">
          {copy[errorCode]}
        </div>
      )}
      <AuthForm mode="sign-up" copy={copy} returnTo={returnTo} />
      <div className="auth-secure">{copy.secure}</div>
      <AuthGuidance copy={copy} preview={preview} />
      <div className="auth-switch">
        {copy.existingMember}{" "}
        <a href={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
          {copy.signInLink}
        </a>
      </div>
      <a href="/" className="auth-back">{copy.back}</a>
    </div>
  );
}