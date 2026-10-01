import { Redirect, Route, Switch } from "wouter";
import {
  SignIn,
  SignUp,
  useUser,
  SupabaseAuthProvider,
} from "./auth";
import { HomeRoute, createAppRoute } from "./guestAppRoutes";
import AppShell from "./AppShell";
import { LanguageProvider } from "./context/LanguageContext";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function SignInPage() {
  const { user } = useUser();
  if (user) return <Redirect to="/app" />;
  return (
    <AuthCard>
      <SignIn />
    </AuthCard>
  );
}

function SignUpPage() {
  const { user } = useUser();
  if (user) return <Redirect to="/app" />;
  return (
    <AuthCard>
      <SignUp />
    </AuthCard>
  );
}

const AppRoute = createAppRoute(AppShell);

export default function App() {
  return (
    <SupabaseAuthProvider>
      <LanguageProvider>
        <Switch>
          <Route path="/" component={HomeRoute} />
          <Route path="/app" component={AppRoute} />
          <Route path="/calendar" component={AppRoute} />
          <Route path="/zmanim" component={AppRoute} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </LanguageProvider>
    </SupabaseAuthProvider>
  );
}
