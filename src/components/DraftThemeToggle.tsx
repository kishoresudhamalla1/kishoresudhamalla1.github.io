import { useEffect, useState } from "react";

/**
 * Manual-only preview switch for the draft "vivid" light theme (see
 * global.css and Base.astro's theme-draft script). Independent of the
 * day/night dark-mode toggle: it never auto-switches, and has no visible
 * effect while dark mode is on, since the CSS it drives is scoped to
 * :not(.dark).
 */
export function DraftThemeToggle() {
  const [vivid, setVivid] = useState(false);

  useEffect(() => {
    setVivid(document.documentElement.getAttribute("data-theme") === "vivid");
  }, []);

  const toggle = () => {
    const next = !vivid;
    setVivid(next);
    document.documentElement.setAttribute("data-theme", next ? "vivid" : "default");
    try {
      localStorage.setItem("theme-draft", next ? "vivid" : "default");
    } catch {
      // ignore
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={vivid}
      className="flex h-8 items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-[0.6875rem] font-medium tracking-wide text-[var(--color-ink-3)] transition-colors hover:text-[var(--color-ink)]"
      title="Preview a draft, more colourful light theme (dark mode is unaffected)"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
      </svg>
      {vivid ? "Vivid" : "Draft theme"}
    </button>
  );
}
