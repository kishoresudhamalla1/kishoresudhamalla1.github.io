/* ─────────────────────────────────────────────────────────────────────────
   THE CLOSED LOOP, decision → action → verify

   The missing half of the intelligence model. A recommendation that nobody
   can accept, and whose effect nobody measures, is just a confident opinion.

   Three rules this implements, in order of importance:

     1. Nothing is written without explicit approval, and the approval step
        shows the exact record that will be created, no hidden side effects.
     2. Every write is reversible for as long as it matters.
     3. Every accepted recommendation captures a BASELINE at decision time,
        so the system can later be judged on whether it helped.

   The verification is genuinely computed, not staged: a ticket's signal is
   derived from its own changelog as of a given date, so "did this get worse
   after we intervened" is answered by the record, not by a stored verdict.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  const KEY = "dops.decisions.v1";
  const $ = (s, r = document) => r.querySelector(s);
  const T_ = () => (typeof TICKETS !== "undefined" ? TICKETS : []);
  const D_ = () => (typeof DESIGNERS !== "undefined" ? DESIGNERS : []);
  const dsg = (id) => D_().find((d) => d.id === id) || { name: id };
  const days = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const today = () => (typeof TODAY !== "undefined" ? TODAY : "2026-08-31");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ── the signal, as of a point in time ──────────────────────────────────
  // Only changes recorded on or before `asOf` count, so a baseline captured
  // at decision time is reconstructible from the changelog rather than stored
  // as someone's summary of it.
  function signalAsOf(t, asOf) {
    const ch = (t.dateChanges || []).filter((c) => !asOf || c.date <= asOf);
    let drift = 0;
    ch.forEach((c) => { if (c.from && c.to) drift += days(c.from, c.to); });
    return { changes: ch.length, drift };
  }

  // ── store ──────────────────────────────────────────────────────────────
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
  const save = (d) => localStorage.setItem(KEY, JSON.stringify(d));

  /* Seeded history so the log has something to verify on first run. These are
     part of the demo dataset: the decision dates are fixed, but the outcomes
     below are computed from each ticket's real changelog, not hardcoded. */
  const SEED = [
    { key: "UX-105", decidedAt: "2026-07-08", verdictAction: "Hold the committed date until the PRD lands",
      action: "Created UX-105-R · Re-baseline review", owner: "priya", outcome: "auto" },
    { key: "UX-303", decidedAt: "2026-07-10", verdictAction: "Escalate the dependency before re-committing",
      action: "Created UX-303-R · Dependency escalation", owner: "arjun", outcome: "auto" },
  ];

  function decisions() {
    let d = load();
    if (!d) {
      d = SEED.filter((s) => T_().some((t) => t.key === s.key)).map((s) => {
        const t = T_().find((x) => x.key === s.key);
        return { ...s, baseline: signalAsOf(t, s.decidedAt), status: "accepted" };
      });
      save(d);
    }
    return d;
  }

  // ── verification ───────────────────────────────────────────────────────
  function verify(rec) {
    const t = T_().find((x) => x.key === rec.key);
    if (!t) return { state: "gone", label: "Ticket no longer in scope", detail: "" };
    const now = signalAsOf(t, null);
    const b = rec.baseline || { changes: 0, drift: 0 };
    const dDrift = now.drift - b.drift;
    const dCh = now.changes - b.changes;

    const elapsed = days(rec.decidedAt, today());
    const SETTLE = 14;   // a fortnight before a "no movement" reading means anything

    if (dCh === 0 && elapsed < SETTLE)
      return { state: "gone", label: "Monitoring",
               detail: `Baseline captured at ${b.drift}d of slip. ${elapsed === 0 ? "Decided today" : `${elapsed} day${elapsed === 1 ? "" : "s"} in`}, too early to judge, so no verdict yet.` };

    if (dCh === 0)
      return { state: "held", label: "Held",
               detail: `No further date movement in the ${elapsed} days since. Baseline ${b.drift}d, still ${now.drift}d.` };
    return { state: "worse", label: "Slipped further",
             detail: `${dCh} more date change${dCh > 1 ? "s" : ""} after the decision, ${dDrift > 0 ? "+" + dDrift : dDrift} days beyond the ${b.drift}d baseline. The intervention did not hold.` };
  }

  // ── decision bar, appended to an explanation ───────────────────────────
  function barMarkup(t, recommendation) {
    const existing = decisions().find((d) => d.key === t.key);
    const open = `<div class="vf-host" data-vf-key="${esc(t.key)}" data-vf-rec="${esc(recommendation)}">`;
    if (existing) {
      const v = verify(existing);
      return open + `
        <div class="vf-bar vf-bar--done">
          <p class="vf-k">Decision recorded · ${esc(existing.decidedAt)}</p>
          <p class="vf-done">${esc(existing.action)}</p>
          <p class="vf-verdict vf-${v.state}"><span></span>${esc(v.label)}, ${esc(v.detail)}</p>
        </div></div>`;
    }
    return open + `
      <div class="vf-bar">
        <p class="vf-k">Your decision</p>
        <div class="vf-btns">
          <button type="button" class="vf-b vf-b--accept" data-vf="accept">Accept</button>
          <button type="button" class="vf-b" data-vf="investigate">Investigate</button>
          <button type="button" class="vf-b" data-vf="dismiss">Dismiss</button>
        </div>
        <p class="vf-note">Nothing is written to Jira until you approve the exact record.</p>
      </div></div>`;
  }

  // ── the approval step: show precisely what will be created ─────────────
  function approvalMarkup(t, rec) {
    const title = `${t.key}-R · Alignment review`;
    return `
      <div class="vf-approve">
        <p class="vf-k">Approve this write</p>
        <div class="vf-rec">
          <div><span>Creates</span><b>${esc(title)}</b></div>
          <div><span>Owner</span><b>${esc(dsg(t.assignee).name)}</b></div>
          <div><span>Links to</span><b>${esc(t.key)}</b></div>
          <div><span>Body</span><b>${esc(rec)}</b></div>
        </div>
        <div class="vf-btns">
          <button type="button" class="vf-b vf-b--accept" data-vf="approve">Approve &amp; create</button>
          <button type="button" class="vf-b" data-vf="cancel">Cancel</button>
        </div>
        <p class="vf-note">This is the only step that writes. It is reversible.</p>
      </div>`;
  }

  function dismissMarkup() {
    return `
      <div class="vf-approve">
        <p class="vf-k">Why is this not worth acting on?</p>
        <input class="vf-in" data-vf-reason placeholder="e.g. already discussed with the PM on Friday" />
        <div class="vf-btns">
          <button type="button" class="vf-b vf-b--accept" data-vf="dismiss-confirm">Record</button>
          <button type="button" class="vf-b" data-vf="cancel">Cancel</button>
        </div>
        <p class="vf-note">Recorded against the pattern, so this stops being surfaced if it keeps being wrong.</p>
      </div>`;
  }

  function toast(msg, undo) {
    const el = document.createElement("div");
    el.className = "vf-toast";
    el.innerHTML = `<span>${esc(msg)}</span><button type="button">Undo</button>`;
    document.body.appendChild(el);
    const kill = () => el.remove();
    el.querySelector("button").addEventListener("click", () => { undo(); kill(); });
    setTimeout(kill, 9000);
  }

  // ── wiring ─────────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-vf]");
    if (!btn) return;
    const host = btn.closest(".vf-host");
    if (!host) return;

    const t = T_().find((x) => x.key === host.dataset.vfKey);
    if (!t) return;
    const rec = host.dataset.vfRec || "";
    const act = btn.dataset.vf;
    const inner = () => host.firstElementChild;

    const reset = () => { host.outerHTML = barMarkup(t, rec); renderLog(); };

    if (act === "accept") {
      inner().outerHTML = approvalMarkup(t, rec);
    } else if (act === "dismiss") {
      inner().outerHTML = dismissMarkup();
    } else if (act === "cancel") {
      reset();
    } else if (act === "investigate") {
      inner().outerHTML = `<div class="vf-bar vf-bar--done">
        <p class="vf-k">Marked for investigation</p>
        <p class="vf-note">Kept on the board, and nothing was written. It resurfaces next week if the signal persists.</p></div>`;
    } else if (act === "approve" || act === "dismiss-confirm") {
      const accepted = act === "approve";
      const reasonEl = host.querySelector("[data-vf-reason]");
      const reason = (reasonEl && reasonEl.value.trim()) || "No reason given";
      const record = {
        key: t.key,
        decidedAt: today(),
        baseline: signalAsOf(t, today()),
        status: accepted ? "accepted" : "dismissed",
        action: accepted ? `Created ${t.key}-R · Alignment review` : `Dismissed, ${reason}`,
        owner: t.assignee,
      };
      const list = decisions();
      list.push(record);
      save(list);
      reset();
      toast(accepted ? `${t.key}-R created and linked.` : "Dismissal recorded.", () => {
        save(decisions().filter((d) => d.decidedAt !== record.decidedAt || d.key !== record.key));
        const h = document.querySelector(`.vf-host[data-vf-key="${t.key}"]`);
        if (h) h.outerHTML = barMarkup(t, rec);
        renderLog();
      });
    }
  });

  // ── decision log ───────────────────────────────────────────────────────
  function logMarkup() {
    const list = decisions();
    if (!list.length) return `<p class="vf-empty">No decisions recorded yet.</p>`;
    return list.map((d) => {
      const v = verify(d);
      const t = T_().find((x) => x.key === d.key);
      return `
        <div class="vf-row">
          <div class="vf-row-h">
            <b>${esc(d.key)}</b>
            <span>${esc(t ? t.summary : "")}</span>
            <em>${esc(d.decidedAt)}</em>
          </div>
          <p class="vf-row-a">${esc(d.action)}</p>
          <p class="vf-row-b">Baseline at decision, ${d.baseline.changes} date change${d.baseline.changes === 1 ? "" : "s"}, ${d.baseline.drift} days of slip</p>
          <p class="vf-verdict vf-${v.state}"><span></span>${esc(v.label)}, ${esc(v.detail)}</p>
        </div>`;
    }).join("");
  }

  function renderLog() {
    const body = $("#vf-log-body");
    if (body) body.innerHTML = logMarkup();
    const n = $("#vf-log-count");
    if (n) n.textContent = decisions().length;
  }

  function mountLog() {
    if ($("#vf-log")) return;
    const el = document.createElement("div");
    el.id = "vf-log";
    el.innerHTML = `
      <div class="vf-log-panel" role="dialog" aria-label="Decision log">
        <div class="vf-log-head">
          <div>
            <p class="vf-k" style="margin:0">Decision log</p>
            <p class="vf-log-sub">Every accepted recommendation, and whether the signal actually moved after it.</p>
          </div>
          <button type="button" class="vf-x" aria-label="Close decision log">&times;</button>
        </div>
        <div id="vf-log-body"></div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener("click", (e) => {
      if (e.target === el || e.target.closest(".vf-x")) el.classList.remove("open");
    });
  }

  function mountOpener() {
    const narr = document.querySelector(".ai-narrative");
    if (!narr || narr.querySelector(".vf-open")) return;
    const b = document.createElement("button");
    b.type = "button"; b.className = "vf-open";
    b.innerHTML = `Decision log <span id="vf-log-count">${decisions().length}</span>`;
    b.addEventListener("click", () => { mountLog(); renderLog(); $("#vf-log").classList.add("open"); });
    const head = narr.querySelector(".ai-head");
    (head || narr).appendChild(b);
  }

  // expose for ai-layer.js to append onto its explanation block
  window.VF = { barMarkup, mountOpener, renderLog };

  new MutationObserver(mountOpener).observe(document.body, { childList: true, subtree: true });
  if (document.readyState !== "loading") mountOpener();
  else document.addEventListener("DOMContentLoaded", mountOpener);
})();
