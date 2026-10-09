import assert from "node:assert/strict";
import test from "node:test";
import {
  appPageFromPath,
  appPathForPage,
  APP_PAGE_PATHS,
} from "./appRoutes";
import { createAppInteractionCallbacks, type AppModal } from "./appInteractions";

test("every app tab has a refreshable route and parses back to its page", () => {
  for (const [page, path] of Object.entries(APP_PAGE_PATHS)) {
    assert.equal(appPageFromPath(path), page);
    assert.equal(appPathForPage(page), path);
  }
  assert.equal(appPageFromPath("/app/"), "home");
  assert.equal(appPathForPage("unknown"), "/app");
});

test("visible Home, More, Settings, Journey, and notification actions dispatch to real destinations", () => {
  const opened: AppModal[] = [];
  const navigated: string[] = [];
  let signedOut = false;
  let toggledTheme = false;
  const actions = createAppInteractionCallbacks({
    navigate: (page) => navigated.push(page),
    openModal: (modal) => opened.push(modal),
    toggleTheme: () => { toggledTheme = true; },
    signOut: () => { signedOut = true; },
  });

  actions.home.onMoreTools();
  actions.home.onNotifBell();
  actions.home.onShowCensus();
  actions.calendar.onNavigate("calendar");
  actions.zmanim.onInfo();
  actions.siddur.onAdmin();
  actions.journey.onShowProfile();
  actions.journey.onShowTorahTracker();
  actions.journey.onSignOut();
  actions.more.onNotifications();
  actions.more.onAnnouncements();
  actions.more.onWhatsNew();
  actions.settings.onFeedbackCenter();
  actions.notifications.onShowPrayers();
  actions.premium.onUpgrade();
  actions.home.onToggleTheme();

  assert.deepEqual(opened, [
    "moreTools",
    "announcements",
    "census",
    "zmanimInfo",
    "admin",
    "profile",
    "torahTracker",
    "announcements",
    "whatsNew",
    "feedback",
    "prayerTimes",
    "premium",
  ]);
  assert.deepEqual(navigated, ["calendar", "notifications"]);
  assert.equal(signedOut, true);
  assert.equal(toggledTheme, true);
});
