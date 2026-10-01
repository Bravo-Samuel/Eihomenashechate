import { Suspense, lazy, type ComponentType } from "react";
import { Redirect } from "wouter";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { useUser, useAuthState } from "./auth";

const Landing = lazy(() => import("./pages/Landing"));
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const DEV_PREVIEW =
  import.meta.env.DEV &&
  (import.meta.env.VITE_DEV_PREVIEW === "true" ||
    new URLSearchParams(window.location.search).get("preview") === "1");

function AuthCard({ children }: { children: React.ReactNode }) {
  const photoUrl = `${basePath}/saipikhup-photo.jpg`;
  return (
    <div className="auth-shell" style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px", overflowY: "auto" }}>
      <div className="mds-card auth-card" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420, margin: "auto 0" }}>
        <div className="auth-brand-header" style={{ backgroundImage: `url(${photoUrl})` }}>
          <div aria-hidden className="auth-top-shimmer" />
          <div className="auth-brand-content">
            <img className="auth-brand-logo" src="/logo.png" alt="Bnei Menashe Calendar" />
            <div className="auth-wordmark">BNEI MENASHE</div>
            <div className="auth-brand-caption">SACRED CALENDAR</div>
            <div aria-hidden style={{ color: "var(--gold)", fontSize: 10, lineHeight: 1 }}>◆</div>
          </div>
        </div>
        <div aria-hidden className="auth-brand-divider" />
        <div className="auth-form-body">{children}</div>
        <div aria-hidden className="auth-bottom-accent" />
      </div>
    </div>
  );
}

function AuthSystemState({
  status,
  onRetry,
}: {
  status: string;
  onRetry: () => Promise<void>;
}) {
  const { lang } = useLanguage();
  const copy =
    lang === "tk"
      ? {
          loadingTitle: "Sessiýa barlanýar",
          loadingBody: "Howpsuz ýagdaýyňyz ýüklenýär…",
          unavailableTitle: "Giriş hyzmaty elýeterli däl",
          unavailableBody: "Sessiýaňyzy häzir barlap bilmedik. Täzeden synanyşyň ýa-da biraz soňrak geliň.",
          retry: "Täzeden synanyş",
          back: "Senenama dolan",
        }
      : {
          loadingTitle: "Checking your session",
          loadingBody: "Loading your secure account status…",
          unavailableTitle: "Sign-in is temporarily unavailable",
          unavailableBody: "We couldn’t check your session right now. Try again or come back in a moment.",
          retry: "Try again",
          back: "Back to calendar",
        };

  return (
    <AuthCard>
      <div
        role={status === "unavailable" ? "alert" : "status"}
        aria-live="polite"
        style={{ padding: "34px 28px 30px", textAlign: "center" }}
      >
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            margin: "0 auto 18px",
            borderRadius: "50%",
            border: "1px solid rgba(212,175,55,0.35)",
            background: "rgba(212,175,55,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#D4AF37",
            fontSize: 21,
          }}
        >
          {status === "loading" ? "…" : "!"}
        </div>
        <h2 style={{ margin: "0 0 9px", color: "#D4AF37", fontSize: 22 }}>
          {status === "loading" ? copy.loadingTitle : copy.unavailableTitle}
        </h2>
        <p style={{ margin: "0 auto", maxWidth: 290, color: "#A89070", fontSize: 13, lineHeight: 1.55 }}>
          {status === "loading" ? copy.loadingBody : copy.unavailableBody}
        </p>
        {status === "unavailable" && (
          <button
            type="button"
            onClick={() => void onRetry()}
            className="btn-gold"
            style={{ width: "100%", marginTop: 24, padding: 13, fontWeight: 700 }}
          >
            {copy.retry}
          </button>
        )}
        <a
          href="/"
          style={{ display: "block", marginTop: 18, color: "#7f755f", fontSize: 12, textDecoration: "none" }}
        >
          {copy.back}
        </a>
      </div>
    </AuthCard>
  );
}


export function HomeRoute() {
  const { user } = useUser();
  const { status, retry } = useAuthState();
  if (DEV_PREVIEW) return <Redirect to="/app" />;
  if (status === "loading") {
    return <AuthSystemState status={status} onRetry={retry} />;
  }
  if (user) return <Redirect to="/app" />;
  return (
    <LanguageProvider>
      <div className="app-container">
        <div className="app-shell">
          <Suspense fallback={null}>
            <Landing
              onSignIn={() => {
                window.location.href = `${basePath}/sign-in`;
              }}
            />
          </Suspense>
        </div>
      </div>
    </LanguageProvider>
  );
}

export function createAppRoute(AppShell: ComponentType) {
  return function AppRoute() {
    const { status, retry } = useAuthState();
    if (DEV_PREVIEW) return <AppShell />;
    if (status === "loading") {
      return <AuthSystemState status={status} onRetry={retry} />;
    }
    // signed-in, signed-out, and unavailable all get AppShell
    return <AppShell />;
  };
}
