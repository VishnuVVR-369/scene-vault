"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from "react";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "scenevault-theme";

/**
 * Inline this in <head> so the correct theme class is set before first paint,
 * preventing a flash. Must stay in sync with the logic below.
 */
export const themeInitScript = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=(s==="dark"||((!s||s==="system")&&m))?"dark":"light";var e=document.documentElement;e.classList.toggle("dark",r==="dark");e.style.colorScheme=r;}catch(e){}})();`;

/* --- External store: localStorage choice + OS preference --------------------- */

const listeners = new Set<() => void>();

// Cached snapshot string ("<theme>|<resolved>") kept referentially stable so
// useSyncExternalStore only re-renders when the value actually changes.
let snapshot = "system|light";

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function getSnapshot(): string {
  const theme = readTheme();
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const next = `${theme}|${resolved}`;
  if (next !== snapshot) {
    snapshot = next;
  }
  return snapshot;
}

function getServerSnapshot(): string {
  return "system|light";
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    media.removeEventListener("change", callback);
    window.removeEventListener("storage", callback);
  };
}

function writeTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  // The "storage" event only fires in other tabs, so notify this one directly.
  listeners.forEach((listener) => listener());
}

/* --- Hook + provider -------------------------------------------------------- */

export function useTheme() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [theme, resolvedTheme] = snap.split("|") as [Theme, ResolvedTheme];
  const setTheme = useCallback((next: Theme) => writeTheme(next), []);
  return { theme, resolvedTheme, setTheme };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();

  // Keep the document class in sync after hydration and live OS changes.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    root.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return <>{children}</>;
}
