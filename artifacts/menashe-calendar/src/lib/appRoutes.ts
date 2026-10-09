export type AppPage =
  | "home"
  | "calendar"
  | "zmanim"
  | "siddur"
  | "journey"
  | "more"
  | "settings"
  | "premium"
  | "notifications";

export type ShortcutPage = "home" | "calendar" | "zmanim";

export const APP_PAGE_PATHS: Record<AppPage, string> = {
  home: "/app",
  calendar: "/calendar",
  zmanim: "/zmanim",
  siddur: "/siddur",
  journey: "/journey",
  more: "/more",
  settings: "/settings",
  premium: "/premium",
  notifications: "/notifications",
};

const PAGE_BY_PATH = new Map(
  Object.entries(APP_PAGE_PATHS).map(([page, path]) => [path, page as AppPage]),
);

export function appPageFromPath(pathname: string): AppPage {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return PAGE_BY_PATH.get(normalized) ?? "home";
}

export function appPathForPage(page: string): string {
  return page in APP_PAGE_PATHS
    ? APP_PAGE_PATHS[page as AppPage]
    : APP_PAGE_PATHS.home;
}

export function shortcutPageFromPath(pathname: string): ShortcutPage {
  const page = appPageFromPath(pathname);
  return page === "calendar" || page === "zmanim" ? page : "home";
}