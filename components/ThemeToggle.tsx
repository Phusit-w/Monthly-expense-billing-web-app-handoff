"use client";

import { useState } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";
import { THEME_COOKIE, THEME_MAX_AGE, type Theme } from "@/lib/theme";

// The light/dark switch in AppTopBar. `initialTheme` comes from the server
// (app/(app)/layout.tsx reads the cookie), so the knob renders in the right
// spot with no hydration flicker. Flipping it retints the shell instantly
// by rewriting `data-theme` on `.app-shell-root` — no reload — and persists
// the choice in the same JS-readable cookie the layout reads on next load.
export default function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const dark = theme === "dark";

  function toggle() {
    const next: Theme = dark ? "light" : "dark";
    const root = document.querySelector<HTMLElement>(".app-shell-root");
    if (root) {
      root.dataset.theme = next;
      root.style.colorScheme = next;
    }
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax`;
    setTheme(next);
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="สลับธีมสว่าง / มืด"
      title={dark ? "ธีมมืด — กดเพื่อสลับเป็นสว่าง" : "ธีมสว่าง — กดเพื่อสลับเป็นมืด"}
      onClick={toggle}
      className="ui-btn relative h-7 w-[52px] shrink-0 rounded-full border border-line bg-chip transition-colors hover:bg-hover hover:border-muted"
    >
      <span
        className="absolute left-0.5 top-0.5 grid size-6 place-items-center rounded-full
          bg-surface text-ink shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-200"
        style={{ transform: dark ? "translateX(24px)" : "translateX(0)" }}
      >
        {dark ? <MoonIcon size={13} /> : <SunIcon size={13} />}
      </span>
    </button>
  );
}
