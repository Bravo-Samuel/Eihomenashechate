import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import PageSkeleton from "./components/PageSkeleton";
import { useAuthActions, useUser, useOrganization } from "./auth";
import {
  fetchUserProfile,
  saveUserProfile,
  fetchPublicProfile,
  type PublicProfile,
} from "./lib/userApi";
import { LanguageProvider } from "./context/LanguageContext";
import BottomNav from "./components/BottomNav";
import { LOCATIONS, type Location } from "./lib/locations";
import { shortcutPageFromPath } from "./lib/appRoutes";

const Home = lazy(() => import("./pages/Home"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ZmanimPage = lazy(() => import("./pages/ZmanimPage"));
const SiddurPage = lazy(() => import("./pages/SiddurPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const JourneyPage = lazy(() => import("./pages/JourneyPage"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const LocationModal = lazy(() => import("./modals/LocationModal"));
const InstallPrompt = lazy(() => import("./components/InstallPrompt"));
const ShabbatBanner = lazy(() => import("./components/ShabbatBanner"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

type Page =
  | "home"
  | "calendar"
  | "zmanim"
  | "siddur"
  | "settings"
  | "premium"
  | "journey"
  | "notifications"
  | "more";

/**
 * Compact AppShell used with optional auth.
 * Guests (signed-out / auth unavailable) can browse Calendar, Zmanim, Siddur, etc.
 * Full modal suite remains available via More / page-level entry points as pages load them.
 */
export default function AppShell() {
  const { user, isLoaded: userLoaded } = useUser();
  const { membership } = useOrganization();
  const { signOut } = useAuthActions();
  const profileSyncedRef = useRef(false);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const [activePage, setActivePage] = useState<Page>(() => {
    const p = shortcutPageFromPath(stripBase(window.location.pathname));
    return (p as Page) || "home";
  });
  const [locationModal, setLocationModal] = useState(false);
  const [toast, setToast] = useState("");
  const [theme, setThemeState] = useState<"dark" | "light" | "sapphire">(() => {
    try {
      return (
        (localStorage.getItem("menashe-theme") as "dark" | "light" | "sapphire") ||
        "dark"
      );
    } catch {
      return "dark";
    }
  });
  const [location, setLocation] = useState<Location>(() => {
    try {
      const saved = localStorage.getItem("menashe-location");
      if (saved) return JSON.parse(saved);
    } catch {}
    return LOCATIONS[0];
  });
  const [isPremium, setIsPremium] = useState(() => {
    try {
      return localStorage.getItem("menashe-is-premium") === "true";
    } catch {
      return false;
    }
  });
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem("menashe-nav-collapsed") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!userLoaded || !user) return;
    void fetchPublicProfile().then((p) => {
      if (p) setPublicProfile(p);
    });
  }, [userLoaded, user?.id]);

  useEffect(() => {
    if (!userLoaded || !user) return;
    void fetchUserProfile().then((profile) => {
      if (!profile) {
        profileSyncedRef.current = true;
        return;
      }
      if (profile.theme) {
        setThemeState(profile.theme);
        try {
          localStorage.setItem("menashe-theme", profile.theme);
        } catch {}
      }
      if (profile.location) {
        setLocation(profile.location);
        try {
          localStorage.setItem(
            "menashe-location",
            JSON.stringify(profile.location),
          );
        } catch {}
      }
      if (profile.isPremium) {
        setIsPremium(true);
        try {
          localStorage.setItem("menashe-is-premium", "true");
        } catch {}
      }
      profileSyncedRef.current = true;
    });
  }, [userLoaded, user?.id]);

  useEffect(() => {
    if (!profileSyncedRef.current) return;
    void saveUserProfile({ theme, location, isPremium });
  }, [theme, location, isPremium]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const setTheme = useCallback(
    (next: "dark" | "light" | "sapphire") => {
      setThemeState(next);
      try {
        localStorage.setItem("menashe-theme", next);
      } catch {}
      showToast(`Theme: ${next}`);
    },
    [showToast],
  );

  const selectLocation = useCallback(
    (loc: Location) => {
      setLocation(loc);
      try {
        localStorage.setItem("menashe-location", JSON.stringify(loc));
      } catch {}
      setLocationModal(false);
      showToast(`Location set to ${loc.name}`);
    },
    [showToast],
  );

  const onNavigate = useCallback((p: string) => setActivePage(p as Page), []);
  const openLocation = useCallback(() => setLocationModal(true), []);
  const toggleNavCollapsed = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("menashe-nav-collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  const isAdmin = membership?.role === "org:admin";
  const pageProps = {
    location,
    onLocationClick: openLocation,
    onNavigate,
    isPremium,
    onShowPremium: () => setActivePage("premium"),
    theme,
    setTheme,
    user,
    publicProfile,
    onSignOut: () => void signOut(),
    isAdmin: !!isAdmin,
  } as Record<string, unknown>;

  function renderPage() {
    switch (activePage) {
      case "calendar":
        return <CalendarPage {...(pageProps as any)} />;
      case "zmanim":
        return <ZmanimPage {...(pageProps as any)} />;
      case "siddur":
        return <SiddurPage {...(pageProps as any)} />;
      case "settings":
        return <SettingsPage {...(pageProps as any)} />;
      case "journey":
        return <JourneyPage {...(pageProps as any)} />;
      case "premium":
        return <PremiumPage {...(pageProps as any)} />;
      case "notifications":
        return <NotificationsPage {...(pageProps as any)} />;
      case "more":
        return <MorePage {...(pageProps as any)} />;
      case "home":
      default:
        return <Home {...(pageProps as any)} />;
    }
  }

  return (
    <LanguageProvider>
      <div
        className={`app-container${theme === "light" ? " light-theme" : theme === "sapphire" ? " sapphire-theme" : ""}`}
      >
        <div className={`app-shell${navCollapsed ? " nav-collapsed" : ""}`}>
          <Suspense fallback={<PageSkeleton />}>
            <div className="screen fade-in" id="main-content" tabIndex={-1}>
              {renderPage()}
            </div>
          </Suspense>
          <BottomNav
            active={activePage}
            onNavigate={onNavigate}
            {...({ collapsed: navCollapsed, onToggleCollapsed: toggleNavCollapsed } as any)}
          />
          {toast ? <div className="toast">{toast}</div> : null}
        </div>
      </div>
      <Suspense fallback={null}>
        {locationModal && (
          <LocationModal
            {...({
              location,
              onSelect: selectLocation,
              onClose: () => setLocationModal(false),
            } as any)}
          />
        )}
        <ShabbatBanner {...({ location } as any)} />
        <InstallPrompt />
      </Suspense>
    </LanguageProvider>
  );
}
