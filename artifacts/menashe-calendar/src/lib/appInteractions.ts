import type { AppPage } from "./appRoutes";

export type AppModal =
  | "moreTools"
  | "holidays"
  | "parashah"
  | "dafYomi"
  | "omer"
  | "community"
  | "census"
  | "members"
  | "announcements"
  | "events"
  | "communityYahrzeit"
  | "yartzeit"
  | "mussar"
  | "prayerBoard"
  | "torahTracker"
  | "hebrewDate"
  | "birthday"
  | "tahara"
  | "sefariaSearch"
  | "whatsNew"
  | "profile"
  | "feedback"
  | "luach"
  | "prayerTimes"
  | "admin"
  | "bookReader"
  | "day"
  | "locationMap"
  | "memorialWall"
  | "zmanimInfo"
  | "premium"
  | "mikvehCalendar";

interface AppInteractionDependencies {
  navigate: (page: AppPage) => void;
  openModal: (modal: AppModal) => void;
  toggleTheme: () => void;
  signOut: () => void;
}

export function createAppInteractionCallbacks({
  navigate,
  openModal,
  toggleTheme,
  signOut,
}: AppInteractionDependencies) {
  const modal = (name: AppModal) => () => openModal(name);
  const page = (name: AppPage) => () => navigate(name);

  return {
    home: {
      onMoreTools: modal("moreTools"),
      onShowHolidays: modal("holidays"),
      onShowParashah: modal("parashah"),
      onShowPremium: page("premium"),
      onShowDafYomi: modal("dafYomi"),
      onShowOmer: modal("omer"),
      onToggleTheme: toggleTheme,
      onOpenSiddur: page("siddur"),
      onShowCommunity: modal("community"),
      onShowCensus: modal("census"),
      onShowMembers: modal("members"),
      onNotifBell: modal("announcements"),
      onShowAnnouncements: modal("announcements"),
      onShowEvents: modal("events"),
      onShowCommunityYahrzeit: modal("communityYahrzeit"),
      onShowYartzeit: modal("yartzeit"),
      onShowMussar: modal("mussar"),
      onShowPrayerBoard: modal("prayerBoard"),
      onShowTorahTracker: modal("torahTracker"),
    },
    calendar: {
      onNavigate: navigate,
    },
    zmanim: {
      onInfo: modal("zmanimInfo"),
      onShowPremium: page("premium"),
    },
    siddur: {
      onAdmin: modal("admin"),
      onShowPremium: page("premium"),
    },
    journey: {
      onShowProfile: modal("profile"),
      onShowPremium: page("premium"),
      onShowTorahTracker: modal("torahTracker"),
      onSignOut: signOut,
      onNavigate: navigate,
    },
    more: {
      onShowPremium: page("premium"),
      onNotifications: page("notifications"),
      onCommunity: modal("community"),
      onAnnouncements: modal("announcements"),
      onEvents: modal("events"),
      onPrayerBoard: modal("prayerBoard"),
      onMembers: modal("members"),
      onYartzeit: modal("yartzeit"),
      onMemorialWall: modal("memorialWall"),
      onTahara: modal("tahara"),
      onDafYomi: modal("dafYomi"),
      onHebrewDate: modal("hebrewDate"),
      onBirthday: modal("birthday"),
      onOmer: modal("omer"),
      onMussar: modal("mussar"),
      onTorahTracker: modal("torahTracker"),
      onCensus: modal("census"),
      onSefariaSearch: modal("sefariaSearch"),
      onSettings: page("settings"),
      onWhatsNew: modal("whatsNew"),
      onNews: modal("announcements"),
      onTzadikim: modal("memorialWall"),
      onLocationMap: modal("locationMap"),
    },
    settings: {
      onToggleTheme: toggleTheme,
      onPremium: page("premium"),
      onTahara: modal("tahara"),
      onYartzeit: modal("yartzeit"),
      onBirthday: modal("birthday"),
      onCommunity: modal("community"),
      onCensus: modal("census"),
      onProfile: modal("profile"),
      onSignOut: signOut,
      onWhatsNew: modal("whatsNew"),
      onFeedbackCenter: modal("feedback"),
    },
    notifications: {
      onNavigate: navigate,
      onShowTorahTracker: modal("torahTracker"),
      onShowPrayers: modal("prayerTimes"),
      onShowYartzeit: modal("yartzeit"),
      onShowCommunity: modal("community"),
      onShowAnnouncements: modal("announcements"),
      onGoBack: page("home"),
    },
    premium: {
      onUpgrade: modal("premium"),
      onBack: page("home"),
    },
  };
}
