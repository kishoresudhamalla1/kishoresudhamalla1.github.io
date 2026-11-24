import { useEffect, useState } from "react";

/**
 * Homepage-only A/B compare switch: old (current) design vs. the gold.css
 * redesign, scoped under html[data-theme="new"]. Pure presentation toggle,
 * no site logic involved. Persisted so a reload keeps your last choice.
 */
export function ThemeCompareToggle() {
  const [variant, setVariant] = useState<"old" | "new">("old");

  useEffect(() => {
    const stored = document.documentElement.getAttribute("data-theme-variant");
    if (stored === "new" || stored === "old") setVariant(stored);
    if (stored === "new") document.documentElement.classList.remove("dark");
  }, []);

  const set = (next: "old" | "new") => {
    setVariant(next);
    document.documentElement.setAttribute("data-theme-variant", next);
    try {
      localStorage.setItem("theme-variant", next);
    } catch {
      // ignore
    }
    // The New pilot is a light-only aesthetic. A handful of components have
    // their own hardcoded .dark-specific rules (e.g. the AI Lab signal
    // card), which fight gold.css's light tokens if the site's own
    // day/night system had already put .dark on <html>. Rather than patch
    // every such rule individually, just turn dark mode off while "new" is
    // active, and hand control back to the site's own theme logic
    // (window.__theme.apply, exposed by Base.astro) when switching back.
    const theme = (window as any).__theme;
    if (next === "new") {
      document.documentElement.classList.remove("dark");
    } else if (theme?.apply) {
      theme.apply();
    }
  };

  return (
    <div className="tcv-rail" role="group" aria-label="Compare old and new homepage design">
      <button
        type="button"
        className="tcv-btn"
        aria-pressed={variant === "old"}
        onClick={() => set("old")}
      >
        Old
      </button>
      <button
        type="button"
        className="tcv-btn"
        aria-pressed={variant === "new"}
        onClick={() => set("new")}
      >
        New
      </button>
    </div>
  );
}
