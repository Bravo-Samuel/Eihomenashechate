import {
  useState,
  useCallback,
  useEffect,
  useRef,
  lazy,
  Suspense,
} from "react";
import { useLocation } from "wouter";
import PageSkeleton from "./components/PageSkeleton";
import type { SelectedDay } from "./components/AppModalHost";
import { useAuthActions, useUser, useOrganization } from "./auth";
import {
  fetchUserProfile,
  saveUserProfile,
  fetchPublicProfile,
  type PublicProfile,
} from "./lib/userApi";
import {
  isProfileSyncedForUser,
  shouldResetProfileForUser,
} from "./lib/profileSync";
import { LanguageProvider } from "./context/LanguageContext";
import BottomNav from "./components/BottomNav";
import { LOCATIONS, type Location } from "./lib/locations";
import { appPageFromPath, appPathForPage } from "./lib/appRoutes";
import { createAppInteractionCallbacks, type AppModal } from "./lib/appInteractions";
import { useNotifications } from "./hooks/useNotifications";
import { usePushSubscription } from "./hooks/usePushSubscription";
import { useAnnouncements } from "./hooks/useAnnouncements";
import type { Book } from "./pages/SiddurPage";

const Home = lazy(() => import("./pages/Home"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const ZmanimPage = lazy(() => import("./pages/ZmanimPage"));
const SiddurPage = lazy(() => import("./pages/SiddurPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const JourneyPage = lazy(() => import("./pages/JourneyPage"));
const PremiumPage = lazy(() => import("./pages/PremiumPage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const AppModalHost = lazy(() => import("./components/AppModalHost"));
const LocationModal = lazy(() => import("./modals/LocationModal"));
const InstallPrompt = lazy(() => import("./components/InstallPrompt"));
const ShabbatBanner = lazy(() => import("./components/ShabbatBanner"));

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const PROFILE_USER_ID_KEY = "menashe-profile-user-id";

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

/**
 * AppShell used with optional auth.
 * Guests (signed-out / auth unavailable) can browse Calendar, Zmanim, Siddur, etc.
 * Page actions are wired here so each page receives its required behavior explicitly.
 */
export default function AppShell() {
  const [routePath, setRoutePath] = useLocation();
  const { user, isLoaded: userLoaded } = useUser();
  const { membership } = useOrganization();
  const { signOut } = useAuthActions();
  const profileRequestUserIdRef = useRef<string | null>(null);
  const profileSyncedUserIdRef = useRef<string | null>(null);
  const profileOwnerUserIdRef = useRef<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(null);
  const activePage = appPageFromPath(stripBase(routePath));
  const [activeModal, setActiveModal] = useState<AppModal | null>(null);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const [booksRefreshKey, setBooksRefreshKey] = useState(0);
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
  const [isPremium, setIsPremium] = useState(false);
  const [candleEnabled, setCandleEnabled] = useState(() => {
    try {
      return localStorage.getItem("menashe-candle-enabled") !== "false";
    } catch {
      return true;
    }
  });
  const [navCollapsed, setNavCollapsed] = useState(() => {
    try {
      return localStorage.getItem("menashe-nav-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const notifications = useNotifications(location);
  const pushSubscription = usePushSubscription(
    location,
    notifications.prefs,
    notifications.leadTime,
    user?.id,
  );
  const announcementsState = useAnnouncements();

  useEffect(() => {
    if (!userLoaded) return;
    if (!user) {
      profileRequestUserIdRef.current = null;
      profileSyncedUserIdRef.current = null;
      setPublicProfile(null);
      setIsPremium(false);
      try {
        localStorage.removeItem("menashe-is-premium");
      } catch {}
      return;
    }

    const userId = user.id;
    let active = true;
    profileRequestUserIdRef.current = userId;
    profileSyncedUserIdRef.current = null;
    setPublicProfile(null);
    void fetchPublicProfile()
      .then((profile) => {
        if (active && profileRequestUserIdRef.current === userId) {
          setPublicProfile(profile);
        }
      })
      .catch(() => {
        if (active && profileRequestUserIdRef.current === userId) {
          setPublicProfile(null);
        }
      });

    return () => {
      active = false;
      if (profileRequestUserIdRef.current === userId) {
        profileRequestUserIdRef.current = null;
      }
      if (profileSyncedUserIdRef.current === userId) {
        profileSyncedUserIdRef.current = null;
      }
    };
  }, [userLoaded, user?.id]);

  useEffect(() => {
    if (!userLoaded) return;
    if (!user) {
      profileRequestUserIdRef.current = null;
      profileSyncedUserIdRef.current = null;
      return;
    }

    const userId = user.id;
    let active = true;
    profileRequestUserIdRef.current = userId;
    profileSyncedUserIdRef.current = null;

    let previousUserId = profileOwnerUserIdRef.current;
    if (!previousUserId) {
      try {
        previousUserId = localStorage.getItem(PROFILE_USER_ID_KEY);
      } catch {}
    }
    const switchedAccount = shouldResetProfileForUser(previousUserId, userId);
    if (switchedAccount) {
      setThemeState("dark");
      setLocation(LOCATIONS[0]);
      setIsPremium(false);
      try {
        localStorage.setItem("menashe-theme", "dark");
        localStorage.setItem("menashe-location", JSON.stringify(LOCATIONS[0]));
      } catch {}
    }

    void fetchUserProfile()
      .then((profile) => {
        if (
          !active ||
          profileRequestUserIdRef.current !== userId ||
          !profile
        ) {
          return;
        }

        const nextTheme = profile.theme || "dark";
        setThemeState(nextTheme);
        try {
          localStorage.setItem("menashe-theme", nextTheme);
        } catch {}

        if (profile.location) {
          setLocation(profile.location);
          try {
            localStorage.setItem(
              "menashe-location",
              JSON.stringify(profile.location),
            );
          } catch {}
        }

        const nextPremium = profile.isPremium === true;
        setIsPremium(nextPremium);
        try {
          localStorage.removeItem("menashe-is-premium");
          localStorage.setItem(PROFILE_USER_ID_KEY, userId);
        } catch {}

        profileOwnerUserIdRef.current = userId;
        profileSyncedUserIdRef.current = userId;
      })
      .catch(() => {
        if (active && profileRequestUserIdRef.current === userId) {
          profileSyncedUserIdRef.current = null;
        }
      });

    return () => {
      active = false;
      if (profileRequestUserIdRef.current === userId) {
        profileRequestUserIdRef.current = null;
      }
      if (profileSyncedUserIdRef.current === userId) {
        profileSyncedUserIdRef.current = null;
      }
    };
  }, [userLoaded, user?.id]);

  useEffect(() => {
    if (
      !userLoaded ||
      !isProfileSyncedForUser(profileSyncedUserIdRef.current, user?.id)
    ) {
      return;
    }
    void saveUserProfile({ theme, location }).catch(() => {
      setToast("Could not sync your settings. Try again when connected.");
      window.setTimeout(() => setToast(""), 2500);
    });
  }, [userLoaded, user?.id, theme, location]);

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

  const onNavigate = useCallback(
    (page: string) => setRoutePath(appPathForPage(page)),
    [setRoutePath],
  );
  const openModal = useCallback((modal: AppModal) => {
    setActiveModal(modal);
  }, []);
  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);
  const openLocation = useCallback(() => setLocationModal(true), []);
  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);
  const toggleCandle = useCallback(() => {
    setCandleEnabled((previous) => {
      const next = !previous;
      try {
        localStorage.setItem("menashe-candle-enabled", String(next));
      } catch {}
      return next;
    });
  }, []);
  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);
  const actions = createAppInteractionCallbacks({
    navigate: onNavigate,
    openModal,
    toggleTheme,
    signOut: handleSignOut,
  });
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
  const handlePremiumActivated = useCallback(() => {
    setIsPremium(true);
    void fetchUserProfile()
      .then((profile) => {
        if (profile?.isPremium) setIsPremium(true);
      })
      .catch(() => {
        showToast("Premium payment was verified, but profile refresh failed.");
      });
  }, [showToast]);

  function renderPage() {
    switch (activePage) {
      case "calendar":
        return (
          <CalendarPage
            location={location}
            onNavigate={onNavigate}
            onLocationClick={openLocation}
            onDayClick={(day, month, year) => {
              setSelectedDay({ day, month, year });
              openModal("day");
            }}
          />
        );
      case "zmanim":
        return (
          <ZmanimPage
            location={location}
            onInfo={actions.zmanim.onInfo}
            onLocationClick={openLocation}
            isPremium={isPremium}
            onShowPremium={actions.zmanim.onShowPremium}
          />
        );
      case "siddur":
        return (
          <SiddurPage
            onReadBook={(book) => {
              setSelectedBook(book);
              openModal("bookReader");
            }}
            onAdmin={actions.siddur.onAdmin}
            refreshKey={booksRefreshKey}
            isPremium={isPremium}
            onShowPremium={actions.siddur.onShowPremium}
            isAdmin={!!isAdmin}
          />
        );
      case "settings":
        return (
          <SettingsPage
            theme={theme}
            location={location}
            onToggleTheme={actions.settings.onToggleTheme}
            onSetTheme={setTheme}
            onLocationClick={openLocation}
            onPremium={actions.settings.onPremium}
            onTahara={actions.settings.onTahara}
            onYartzeit={actions.settings.onYartzeit}
            onBirthday={actions.settings.onBirthday}
            onCommunity={actions.settings.onCommunity}
            onCensus={actions.settings.onCensus}
            onProfile={actions.settings.onProfile}
            onSignOut={actions.settings.onSignOut}
            onWhatsNew={actions.settings.onWhatsNew}
            onFeedbackCenter={actions.settings.onFeedbackCenter}
            profileName={publicProfile?.displayName ?? user?.fullName ?? ""}
            profileRole={publicProfile?.role ?? ""}
            notifPermission={notifications.permission}
            notifPrefs={notifications.prefs}
            leadTime={notifications.leadTime}
            onUpdateNotifPref={notifications.updatePref}
            onUpdateLeadTime={notifications.updateLeadTime}
            pushSubscribed={pushSubscription.isSubscribed}
            pushSupported={pushSubscription.isSupported}
            pushLoading={pushSubscription.isLoading}
            pushError={pushSubscription.error}
            onSubscribePush={pushSubscription.subscribe}
            onUnsubscribePush={pushSubscription.unsubscribe}
            onTestPush={pushSubscription.sendTest}
          />
        );
      case "journey":
        return (
          <JourneyPage
            isPremium={isPremium}
            publicProfile={publicProfile}
            onNavigate={onNavigate}
            onShowProfile={actions.journey.onShowProfile}
            onShowPremium={actions.journey.onShowPremium}
            onShowTorahTracker={actions.journey.onShowTorahTracker}
            onSignOut={actions.journey.onSignOut}
          />
        );
      case "premium":
        return (
          <PremiumPage
            isPremium={isPremium}
            onUpgrade={actions.premium.onUpgrade}
            onBack={actions.premium.onBack}
          />
        );
      case "notifications":
        return (
          <NotificationsPage
            notifPermission={notifications.permission}
            notifPrefs={notifications.prefs}
            leadTime={notifications.leadTime}
            onUpdateNotifPref={notifications.updatePref}
            onUpdateLeadTime={notifications.updateLeadTime}
            pushSubscribed={pushSubscription.isSubscribed}
            pushSupported={pushSubscription.isSupported}
            pushLoading={pushSubscription.isLoading}
            pushError={pushSubscription.error}
            onSubscribePush={pushSubscription.subscribe}
            onUnsubscribePush={pushSubscription.unsubscribe}
            onSendTestPush={pushSubscription.sendTest}
            announcements={announcementsState.announcements}
            isPremium={isPremium}
            onNavigate={onNavigate}
            onShowTorahTracker={actions.notifications.onShowTorahTracker}
            onShowPrayers={actions.notifications.onShowPrayers}
            onShowYartzeit={actions.notifications.onShowYartzeit}
            onShowCommunity={actions.notifications.onShowCommunity}
            onShowAnnouncements={actions.notifications.onShowAnnouncements}
            onGoBack={actions.notifications.onGoBack}
          />
        );
      case "more":
        return (
          <MorePage
            isPremium={isPremium}
            announcementCount={announcementsState.unreadCount}
            {...actions.more}
            onPrayerBoard={actions.more.onPrayerBoard}
            onOmer={actions.more.onOmer}
            onMussar={actions.more.onMussar}
            onTorahTracker={actions.more.onTorahTracker}
            onCensus={actions.more.onCensus}
            onSefariaSearch={actions.more.onSefariaSearch}
            onRateUs={() => {
              window.location.href =
                "mailto:feedback@bneimenashe.com?subject=App%20Feedback";
            }}
            onInviteFriends={async () => {
              const shareData = {
                title: "Bnei Menashe Calendar",
                text: "I use this sacred Jewish calendar app — check it out!",
                url: window.location.origin,
              };
              if (navigator.share) {
                try {
                  await navigator.share(shareData);
                  return;
                } catch (error) {
                  if (
                    error instanceof DOMException &&
                    error.name === "AbortError"
                  ) {
                    return;
                  }
                }
              }
              try {
                await navigator.clipboard.writeText(shareData.url);
                showToast("Invite link copied.");
              } catch {
                window.prompt("Copy this invite link", shareData.url);
              }
            }}
            onChabadHouses={() => {
              const query = encodeURIComponent(
                `Chabad House near ${location.name}`,
              );
              window.open(
                `https://www.google.com/maps/search/?api=1&query=${query}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
          />
        );
      case "home":
      default:
        return (
          <Home
            location={location}
            theme={theme}
            isPremium={isPremium}
            candleEnabled={candleEnabled}
            onNavigate={onNavigate}
            {...actions.home}
            onLocationClick={openLocation}
            notifActive={Object.values(notifications.prefs).some(Boolean)}
            announcementCount={announcementsState.unreadCount}
          />
        );
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
            collapsed={navCollapsed}
            onToggleCollapsed={toggleNavCollapsed}
          />
          {toast ? <div className="toast">{toast}</div> : null}
        </div>
      </div>
      <Suspense fallback={null}>
        {activeModal && (
          <AppModalHost
            modal={activeModal}
            onClose={closeModal}
            onOpenModal={openModal}
            onNavigate={onNavigate}
            location={location}
            user={user}
            isAdmin={!!isAdmin}
            isPremium={isPremium}
            candleEnabled={candleEnabled}
            onToggleCandle={toggleCandle}
            announcements={announcementsState.announcements}
            onAddAnnouncement={announcementsState.addAnnouncement}
            onUpdateAnnouncement={announcementsState.updateAnnouncement}
            onDeleteAnnouncement={announcementsState.deleteAnnouncement}
            onSendAnnouncement={announcementsState.sendNow}
            book={selectedBook}
            day={selectedDay}
            onRefreshBooks={() => setBooksRefreshKey((key) => key + 1)}
            onProfileSaved={setPublicProfile}
            onPremiumActivated={handlePremiumActivated}
          />
        )}
        {locationModal && (
          <LocationModal
            current={location}
            onSelect={selectLocation}
            onClose={() => setLocationModal(false)}
          />
        )}
        <ShabbatBanner {...({ location } as any)} />
        <InstallPrompt />
      </Suspense>
    </LanguageProvider>
  );
}
