/* Shell behaviour: nav collapse, and keeping the ask bar clear of the panel. */
(function () {
  function mount() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar || sidebar.dataset.shellReady) return;
    sidebar.dataset.shellReady = "1";

    // ── Collapse / restore ────────────────────────────────────────────────
    const collapse = document.createElement("button");
    collapse.type = "button";
    collapse.className = "nav-toggle";
    collapse.innerHTML = "&#10094;";
    collapse.setAttribute("aria-label", "Collapse navigation");
    collapse.setAttribute("aria-expanded", "true");
    sidebar.appendChild(collapse);

    const restore = document.createElement("button");
    restore.type = "button";
    restore.className = "nav-restore";
    restore.innerHTML = "&#9776;";
    restore.setAttribute("aria-label", "Show navigation");
    document.body.appendChild(restore);

    const set = (collapsed) => {
      document.body.classList.toggle("nav-collapsed", collapsed);
      collapse.setAttribute("aria-expanded", String(!collapsed));
      // Tables and charts size themselves on layout; the width change has to
      // be announced or they keep the old width until the next interaction.
      setTimeout(() => window.dispatchEvent(new Event("resize")), 360);
    };

    collapse.addEventListener("click", () => set(true));
    restore.addEventListener("click", () => {
      set(false);
      collapse.focus();
    });

    // ── Keep the ask bar out from under the ticket panel ──────────────────
    // The panel is opened by the app writing an inline display style, so the
    // only reliable signal is the attribute itself.
    const overlay = document.getElementById("ticket-panel-overlay");
    if (overlay) {
      const sync = () =>
        document.body.classList.toggle(
          "panel-open",
          getComputedStyle(overlay).display !== "none"
        );
      new MutationObserver(sync).observe(overlay, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
      sync();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
