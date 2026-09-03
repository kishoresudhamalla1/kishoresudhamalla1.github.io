import { useEffect, useState } from "react";

declare global {
  interface Window {
    __theme?: { resolve(): string; apply(): void; set(v: "dark" | "light"): void };
  }
}

export function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains("dark"));
    sync();
    // The schedule can flip the theme under us: at the 6:30pm boundary, when
    // the tab is refocused, or when the OS switches. Follow it, or the icon
    // ends up showing the opposite of the theme actually on screen.
    document.addEventListener("themechange", sync);
    return () => document.removeEventListener("themechange", sync);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    // Delegated so the button and the pre-paint script share one definition
    // of what a manual choice means and how long it lasts.
    window.__theme?.set(next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={dark}
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-border)]"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}
