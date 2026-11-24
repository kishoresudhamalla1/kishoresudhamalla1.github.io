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
  }, []);

  const set = (next: "old" | "new") => {
    setVariant(next);
    document.documentElement.setAttribute("data-theme-variant", next);
    try {
      localStorage.setItem("theme-variant", next);
    } catch {
      // ignore
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
