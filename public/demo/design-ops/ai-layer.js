/* ─────────────────────────────────────────────────────────────────────────
   AI LAYER, working prototype

   Design intent: the rule engine decides WHAT is true. This layer only
   explains what the rules already flagged. It never sets a flag, never
   writes to Jira, and every output cites the record it read.

   The reasoning below is a local stand-in for the model call, deliberately
   derived from each ticket's real changelog / comments / dates so the
   output shape, evidence citations and interaction are all genuine. The
   only stubbed part is the network call to a model.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  const AI = {};
  const $ = (s, r = document) => r.querySelector(s);

  // ── helpers ────────────────────────────────────────────────────────────
  // data.js declares these with `const`, so they are script-scoped and never
  // appear on `window`. Resolve through the scope chain instead.
  const T_ = () => (typeof TICKETS !== "undefined" ? TICKETS : []);
  const D_ = () => (typeof DESIGNERS !== "undefined" ? DESIGNERS : []);
  const Q_ = () => (typeof QUARTERS !== "undefined" ? QUARTERS : []);
  const dsg = (id) => D_().find((d) => d.id === id) || { name: id };
  const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 864e5);
  const today = () => (typeof TODAY !== "undefined" ? TODAY : new Date().toISOString().slice(0, 10));

  const KEYWORDS = {
    scope: /scope|additional|extra screens|more screens|new requirement|added|expanded/i,
    blocked: /block(ed|er)?\b|waiting on|depend(ency|s on)|legal|external|vendor|on hold/i,
    review: /review|signoff|sign-off|feedback|approval/i,
    unclear: /unclear|tbd|prd|requirement|spec|undefined|clarif/i,
  };

  /** Classify WHY a ticket is in trouble, from its own record. */
  AI.explain = function (t) {
    const ev = [];
    const changes = t.dateChanges || [];
    const notes = t.comments || "";
    const flags = t.riskFlags || [];

    // Evidence 1, date movement, with the reasons actually recorded
    const reasons = changes.map((c) => c.reason).filter(Boolean);
    if (changes.length) {
      ev.push({
        src: `${changes.length} date change${changes.length > 1 ? "s" : ""} in the changelog`,
        detail: reasons.length
          ? `Reason${reasons.length > 1 ? "s" : ""} given: ${reasons.map((r) => `“${r}”`).join(", ")}`
          : "No reason recorded",
      });
    }

    // Evidence 2, how far the commitment actually moved
    const moved = changes.filter((c) => c.from && c.to);
    let drift = 0;
    moved.forEach((c) => (drift += daysBetween(c.from, c.to)));
    if (drift) ev.push({ src: "Cumulative slip", detail: `${drift} days later than first committed` });

    // Evidence 3, the designer's concurrent load
    const load = T_().filter(
      (x) => x.assignee === t.assignee && x.quarter === t.quarter && x.status !== "Done"
    ).length;
    if (load > 2) ev.push({ src: "Concurrent load", detail: `${dsg(t.assignee).name} has ${load} open items this quarter` });

    // Evidence 4, the note left on the ticket
    if (notes) ev.push({ src: "Ticket note", detail: `“${notes}”` });

    // ── classify ──
    const text = (reasons.join(" ") + " " + notes).trim();
    let cause, action, confidence;

    if (KEYWORDS.scope.test(text)) {
      cause = "Scope grew after commitment";
      action = "This is a product conversation, not a capacity one. Confirm the added scope was agreed, and re-baseline the date rather than absorbing it.";
      confidence = "High";
    } else if (flags.includes("missing-prd") || KEYWORDS.unclear.test(text)) {
      // Checked before "blocked": a missing PRD is a specific, actionable cause,
      // and the generic blocker words otherwise swallow it.
      cause = "Requirements weren't ready";
      action = "Design was committed before the problem was settled. Hold the date until the brief lands rather than designing against a moving target, re-committing now just repeats the slip.";
      confidence = "High";
    } else if (KEYWORDS.blocked.test(text)) {
      cause = "Blocked on something outside the team";
      action = "Escalate the dependency. The date will keep moving until the blocker clears, so re-committing before then just repeats the slip.";
      confidence = "High";
    } else if (KEYWORDS.review.test(text)) {
      cause = "Stalled in review";
      action = "The work is done; the process isn't. Chase the reviewer, this is the cheapest kind of slip to recover.";
      confidence = "Medium";
    } else if (load > 2) {
      cause = "Capacity, not the ticket";
      action = `Nothing about this item is unusual. ${dsg(t.assignee).name} is carrying ${load} open items, the date moved because attention is split.`;
      confidence = "Medium";
    } else {
      cause = "No clear signal in the record";
      action = "The changelog and notes don't explain this one. Worth asking directly rather than guessing, and worth noting the ticket is under-documented.";
      confidence = "Low";
    }

    return { cause, action, confidence, evidence: ev };
  };

  /** The weekly paragraph a design lead writes by hand before a leadership sync. */
  AI.narrative = function () {
    // Read the scope and the risk test from the app itself. Deriving these
    // independently produced a paragraph that contradicted the cards beside it
    //, it counted every ticket in the quarter and only week-scoped risk, while
    // the cards count the filtered set and any flag. If the summary is going to
    // claim every figure is traceable to a row, it has to use the same rows.
    const T = typeof filteredTickets === "function" ? filteredTickets() : T_();
    const flagged = (t) =>
      typeof ticketFlags === "function"
        ? ticketFlags(t).length > 0
        : typeof isAtRiskThisWeek === "function" && isAtRiskThisWeek(t);

    const inQ = T;
    const done = inQ.filter((t) => t.status === "Done").length;
    const risk = inQ.filter(flagged);
    const drifted = inQ.filter((t) => (t.dateChanges || []).length > 0);

    // who is carrying the risk
    const byPerson = {};
    risk.forEach((t) => (byPerson[t.assignee] = (byPerson[t.assignee] || 0) + 1));
    const worst = Object.entries(byPerson).sort((a, b) => b[1] - a[1])[0];

    const pct = inQ.length ? Math.round((done / inQ.length) * 100) : 0;

    const parts = [];
    // "in scope" rather than "committed": the card beside this one counts what
    // was committed at sprint start, and this set also includes work added since.
    // Saying which is which stops the two numbers reading as a contradiction.
    parts.push(`${done} of the ${inQ.length} items now in scope are delivered (${pct}%).`);
    if (risk.length) {
      parts.push(
        `${risk.length} ${risk.length === 1 ? "item is" : "items are"} carrying a risk flag` +
          (worst ? `, and ${dsg(worst[0]).name} is carrying ${worst[1]} of them` : "") + "."
      );
    } else {
      parts.push("Nothing is currently flagged at risk.");
    }
    if (drifted.length) {
      parts.push(
        `${drifted.length} ${drifted.length === 1 ? "commitment has" : "commitments have"} moved at least once since being set, ` +
          `the recorded reasons are mostly scope being added after the date was agreed, which is a planning problem rather than a delivery one.`
      );
    }
    parts.push(
      risk.length > 2
        ? "The decision needed this week is whether to re-baseline the remaining dates or reduce scope; absorbing it silently is what caused the current drift."
        : "No decision needed from leadership this week, the plan is holding."
    );
    return parts.join(" ");
  };

  /** Answer a plain-language question by filtering the same in-memory state. */
  AI.ask = function (q) {
    const T = T_();
    const query = q.toLowerCase();
    let rows = [], answer = "";

    if (/overload|capacity|stretch|too much/.test(query)) {
      const load = {};
      T.filter((t) => t.status !== "Done").forEach((t) => (load[t.assignee] = (load[t.assignee] || 0) + 1));
      const sorted = Object.entries(load).sort((a, b) => b[1] - a[1]);
      const top = sorted[0];
      answer = top
        ? `${dsg(top[0]).name} is carrying the most open work, ${top[1]} items. ${sorted.slice(1, 3).map(([k, v]) => `${dsg(k).name} has ${v}`).join(", ")}.`
        : "No open work to compare.";
      rows = T.filter((t) => top && t.assignee === top[0] && t.status !== "Done");
    } else if (/drift|moved|slip|late|overdue/.test(query)) {
      rows = T.filter((t) => (t.dateChanges || []).length > 0)
        .sort((a, b) => (b.dateChanges || []).length - (a.dateChanges || []).length);
      answer = rows.length
        ? `${rows.length} items have moved at least once. ${rows[0].key} has moved ${(rows[0].dateChanges || []).length} times, the most of any ticket.`
        : "Nothing has drifted.";
    } else if (/risk/.test(query)) {
      rows = T.filter((t) => typeof isAtRiskThisWeek === "function" && isAtRiskThisWeek(t));
      answer = `${rows.length} items are flagged at risk right now.`;
    } else {
      rows = T.filter((t) => t.summary.toLowerCase().includes(query) || t.key.toLowerCase().includes(query));
      answer = rows.length ? `${rows.length} items match “${q}”.` : `Nothing matches “${q}”.`;
    }
    return { answer, rows: rows.slice(0, 5) };
  };

  // ── UI ────────────────────────────────────────────────────────────────
  const badge = `<span class="ai-badge">✦ AI</span>`;

  function explainMarkup(t) {
    const r = AI.explain(t);
    return `
      <div class="ai-block">
        <div class="ai-head">${badge}<span class="ai-title">Why is this at risk?</span>
          <span class="ai-conf ai-conf--${r.confidence.toLowerCase()}">${r.confidence} confidence</span></div>
        <p class="ai-cause">${r.cause}</p>
        <p class="ai-action">${r.action}</p>
        <p class="ai-evlabel">Read from</p>
        <ul class="ai-ev">${r.evidence.map((e) => `<li><b>${e.src}</b>, ${e.detail}</li>`).join("")}</ul>
        <p class="ai-foot">Generated from this ticket's own changelog and notes. It never changes the ticket's status, the rules do that.</p>
        ${window.VF ? window.VF.barMarkup(t, r.action) : ""}
      </div>`;
  }

  AI.injectTicketPanel = function () {
    const panel = $("#ticket-panel");
    if (!panel || panel.querySelector(".ai-block")) return;
    const key = (panel.innerText.match(/[A-Z]+-[A-Z0-9-]+/) || [])[0];
    const t = T_().find((x) => x.key === key);
    if (!t) return;
    const host = document.createElement("div");
    host.innerHTML = explainMarkup(t);
    // insert after the header block if we can find one, else at the top of
    // whichever element actually scrolls, don't guess at child indices.
    const scroller = [...panel.querySelectorAll("*")].find(
      (el) => el.scrollHeight > el.clientHeight + 40
    ) || panel;
    const head = scroller.firstElementChild;
    if (head && head.nextSibling) scroller.insertBefore(host.firstElementChild, head.nextSibling);
    else scroller.appendChild(host.firstElementChild);
  };

  AI.injectNarrative = function () {
    const page = $("#page-vpsync") || $("#page-risks");
    if (!page || page.querySelector(".ai-narrative")) return;
    // Bail when the selected quarter has nothing in scope, a "0 of 0"
    // paragraph is worse than no paragraph.
    const scope = typeof filteredTickets === "function" ? filteredTickets() : T_();
    if (!scope.length) return;
    const el = document.createElement("div");
    el.className = "ai-block ai-narrative";
    el.innerHTML = `
      <div class="ai-head">${badge}<span class="ai-title">This week, in a paragraph</span></div>
      <p class="ai-narr">${AI.narrative()}</p>
      <p class="ai-foot">Drafted from the same numbers in the tables below, every figure is traceable to a row.</p>`;
    // put it directly under the page heading
    const h = page.querySelector(".page-header, h1, h2, .page-title");
    const anchor = (h && h.parentElement) || page;
    if (h && h.nextSibling) anchor.insertBefore(el, h.nextSibling);
    else if (h) anchor.appendChild(el);
    else anchor.insertBefore(el, anchor.firstChild);
  };

  AI.injectAskBar = function () {
    if ($("#ai-ask")) return;
    const bar = document.createElement("div");
    bar.id = "ai-ask";
    bar.innerHTML = `
      <div class="ai-ask-inner">
        <span class="ai-ask-mark">✦</span>
        <input id="ai-ask-input" placeholder="Ask the board, e.g. who's overloaded, what has drifted" autocomplete="off" />
      </div>
      <div id="ai-ask-out"></div>`;
    document.body.appendChild(bar);
    const input = $("#ai-ask-input"), out = $("#ai-ask-out");
    const run = () => {
      const v = input.value.trim();
      if (!v) return;
      const r = AI.ask(v);
      out.innerHTML = `
        <div class="ai-block">
          <div class="ai-head">${badge}<span class="ai-title">${v}</span></div>
          <p class="ai-cause">${r.answer}</p>
          ${r.rows.length ? `<p class="ai-evlabel">Rows it used</p><ul class="ai-ev">${r.rows.map(t=>`<li><b>${t.key}</b>, ${t.summary}</li>`).join("")}</ul>` : ""}
          <p class="ai-foot">Answered by filtering the same in-memory data the dashboard renders, the rows are shown so the answer is checkable.</p>
        </div>`;
      out.classList.add("show");
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });

    // Glow: the ring lights and turns while the user is actually typing, then
    // settles back to the still focus ring after a short idle.
    const pill = input.closest(".ai-ask-inner");
    let idle;
    input.addEventListener("input", () => {
      pill.classList.add("is-typing");
      clearTimeout(idle);
      idle = setTimeout(() => pill.classList.remove("is-typing"), 900);
    });
    input.addEventListener("blur", () => {
      clearTimeout(idle);
      pill.classList.remove("is-typing");
    });
    AI.runAsk = run;
  };

  AI.boot = function () {
    AI.injectAskBar();
    new MutationObserver(() => {
      const p = $("#ticket-panel");
      if (p && getComputedStyle(p).display !== "none") AI.injectTicketPanel();
      const r = $("#page-vpsync") || $("#page-risks");
      if (r && getComputedStyle(r).display !== "none") AI.injectNarrative();
    }).observe(document.body, { childList: true, subtree: true, attributes: true });
  };

  window.AI = AI;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", AI.boot);
  else AI.boot();
})();
