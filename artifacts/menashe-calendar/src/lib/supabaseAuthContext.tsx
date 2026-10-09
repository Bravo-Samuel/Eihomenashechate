import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";

import {
  safeSignUpDiagnostic,
  safeThrownSignUpDiagnostic,
  type SignUpDiagnostic,
} from "./authErrors";
import { isSupabaseConfigured, supabase } from "./supabase";

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
  errorCode?: string | null;
  errorStatus?: number | null;
  requiresConfirmation?: boolean;
  diagnostic?: SignUpDiagnostic;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoaded: boolean;
  status: AuthStatus;
  authError: "unavailable" | null;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
};

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "unavailable";

const AuthContext = createContext<AuthContextValue | null>(null);

export function requireAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("Auth hooks must be used inside SupabaseAuthProvider");
  }
  return context;
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
    if (!supabase) {
      setUser(null);
      setAuthError("unavailable");
      setStatus("unavailable");
      setIsLoaded(true);
      return;
    }
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
    if (!isSupabaseConfigured || !supabase) {
      setUser(null);
      setAuthError("unavailable");
      setStatus("unavailable");
      setIsLoaded(true);
      return;
    }
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
      if (!supabase) return { error: "migration_unavailable" };
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
      if (!supabase) return { error: "migration_unavailable" };
      let response: Awaited<ReturnType<typeof supabase.auth.signUp>>;
      try {
        response = await supabase.auth.signUp({ email, password });
      } catch (error) {
        const diagnostic = safeThrownSignUpDiagnostic(error);
        if (import.meta.env.DEV) {
          console.warn("SIGNUP_FAILED", diagnostic);
        }
        return { error: "signup_request_failed", diagnostic };
      }
      const { data, error } = response;
      const diagnostic = error
        ? safeSignUpDiagnostic(error.code, error.status, error.message)
        : undefined;
      if (error && import.meta.env.DEV) {
        console.warn("SIGNUP_FAILED", diagnostic);
      }
      if (!error && data.session) {
        const result = await syncSession(data.session);
        if (result === "unavailable") {
          return { error: "migration_unavailable" };
        }
      }
      return {
        error: error?.message ?? null,
        errorCode: error?.code ?? null,
        errorStatus: error?.status ?? null,
        requiresConfirmation: !error && !data.session,
        diagnostic,
      };
    },
    [syncSession],
  );

  const signOut = useCallback(async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
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
      signOut,
    }),
    [authError, isLoaded, refresh, signIn, signOut, signUp, status, user],
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
