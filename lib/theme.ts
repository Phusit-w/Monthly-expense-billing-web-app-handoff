// Light/dark theme for the app shell (the `.app-shell-root` in
// app/(app)/layout.tsx — /login and the printed A4 paper are deliberately
// never themed). The choice rides in a plain, JS-readable cookie: the
// layout reads it server-side so the correct `data-theme` is in the SSR'd
// HTML (no flash, no inline script), and ThemeToggle writes it client-side
// so the switch flips instantly without a round-trip.

export type Theme = "light" | "dark";

export const THEME_COOKIE = "theme";

// ~400 days — Chrome's own cap on cookie lifetime, same as the
// `lastEmployeeName` cookie in actions/profile.ts.
export const THEME_MAX_AGE = 60 * 60 * 24 * 400;

// Anything that isn't exactly "dark" falls back to light — that's the
// default look and what everyone sees until they flip the switch.
export function parseTheme(raw: string | undefined): Theme {
  return raw === "dark" ? "dark" : "light";
}
