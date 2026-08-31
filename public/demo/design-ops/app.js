/* ============================================================
   Design Ops Dashboard. Bento Edition  app.js
   ============================================================ */

// ── State ───────────────────────────────────────────────────
let currentPage = "";
let selectedQuarter = ACTIVE_QUARTER;
let selectedPod    = "all";
let riskFilter     = "all";
let expandedRisk   = null;
let expandedIntelDesigner = null;
let expandedPlanningRow = null;
let intelTab = "workload";
let intelRecoSlide = 0;
let digestView = "overview";   // "overview" | designer id
let expandedDesignerCard = null;
let designerCardTab = {};      // { designerId: "overall" | "week" }
let homeViewMode = "week";       // "week" | "quarter", overview toggle
let workDesignerFilter = "all"; // "all" | designer id
let workDesignerTabsExpanded = false; // only relevant when selectedPod === "all", too many people to show by default
let workViewMode = "week";      // "week" | "quarter", default to This Week
let vpSyncMidOpen = false;      // toggle mid-sprint drill-down in exec summary
let vpAtRiskExpanded = false;   // expand at-risk ticket table in exec summary
let vpDeviationsExpanded = false;  // expand scope-deviations table in exec summary
let vpAtRiskViewMode = "week";  // "week" | "quarter", filters the At Risk drill-down table
let homeAtRiskViewMode = "week";  // same toggle, Overview page's At Risk drill-down
// UX Signoff tickets are in the dev team's court, not the UX team's, they sit stale on
// the board until dev pushes back, so they're noise for UX's own work-tracking view.
// Persisted so the toggle doesn't reset every reload.
let hideUxSignoff = localStorage.getItem("designOps_hideUxSignoff") === "1";
var _vpExpandedDesigner = null; // designer id whose at-risk tickets are expanded

// ── Designer colour palette ──────────────────────────────────
function dColor(id) {
  var d = DESIGNERS.find(function(d){ return d.id === id; });
  return d ? d.color : "#64748b";
}
function initials(name) {
  var parts = name.split(" ").filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// ── Pod config (localStorage) ────────────────────────────────
var podsConfig = [];
// Team roster, stored as an EXCLUDED set, not an included one. Storing who's included
// used to snapshot the roster at save time, so anyone auto-created from Jira afterwards
// (a new assignee, a new hire, including possibly the user's own account) was silently
// invisible everywhere (Work View, Overview, Exec Summary) because they'd never be in that
// frozen "included" list. Storing exclusions instead means a new designer defaults to
// visible unless someone explicitly removed them.
var teamExcluded = null;  // null = no exclusions (show everyone)

function loadPods() {
  try { podsConfig = JSON.parse(localStorage.getItem("designOps_pods") || "[]"); }
  catch(e) { podsConfig = []; }
  try {
    var rawExcluded = localStorage.getItem("designOps_teamExcluded");
    if (rawExcluded !== null) {
      teamExcluded = new Set(JSON.parse(rawExcluded));
    } else {
      // One-time migration from the old included-list format, so an existing roster
      // configuration isn't silently reset to "everyone" on first load after this fix.
      var rawIncluded = localStorage.getItem("designOps_teamMembers");
      if (rawIncluded) {
        var included = new Set(JSON.parse(rawIncluded));
        teamExcluded = new Set(DESIGNERS.filter(function(d){ return !included.has(d.id); }).map(function(d){ return d.id; }));
        localStorage.setItem("designOps_teamExcluded", JSON.stringify([...teamExcluded]));
        localStorage.removeItem("designOps_teamMembers");
      } else {
        teamExcluded = null;
      }
    }
  } catch(e) { teamExcluded = null; }
}

function savePods() {
  localStorage.setItem("designOps_pods", JSON.stringify(podsConfig));
}
function saveTeamExcluded() {
  if (teamExcluded === null) localStorage.removeItem("designOps_teamExcluded");
  else localStorage.setItem("designOps_teamExcluded", JSON.stringify([...teamExcluded]));
}
function isOnTeam(designerId) {
  return teamExcluded === null ? true : !teamExcluded.has(designerId);
}

function renderPodFilterBar() {
  var bar = document.getElementById("pod-filter-bar");
  if (!bar) return;
  var podColors = ["#6366f1","#ec4899","#f59e0b","#10b981","#3b82f6","#8b5cf6"];
  var html = '<span class="pf-label">View:</span>'
    + '<button class="pf-btn' + (selectedPod==="all"?" active":"") + '" onclick="setPodFilter(\'all\')">All Pods</button>'
    + podsConfig.map(function(p, i) {
        var isActive = selectedPod === p.id;
        return '<button class="pf-btn' + (isActive?" active":"") + '" onclick="setPodFilter(\'' + p.id + '\')">'
          + '<span class="pf-dot" style="background:' + podColors[i % podColors.length] + '"></span>' + p.name
          + '</button>';
      }).join("")
    + '<button onclick="openPodManager()" style="margin-left:8px;padding:4px 10px;font-size:11px;border:1px dashed var(--border);border-radius:20px;background:transparent;color:var(--t3);cursor:pointer">⚙ ' + (podsConfig.length ? "Manage" : "Set up") + ' Pods</button>';
  bar.innerHTML = html;
}

// ── Pod filter ───────────────────────────────────────────────
function setPodFilter(pod) {
  selectedPod = pod;
  if (pod === "all") workDesignerTabsExpanded = false;  // collapse back to on-demand when returning to All Pods
  renderPodFilterBar();
  navigate(currentPage, false);
}

function filteredDesigners() {
  // Team roster filter applies first, anyone not on the team is hidden everywhere.
  var team = DESIGNERS.filter(function(d){ return isOnTeam(d.id); });
  if (selectedPod === "all") return team;
  var pod = podsConfig.find(function(p){ return p.id === selectedPod; });
  if (!pod) return team;
  return team.filter(function(d){ return pod.designers.indexOf(d.id) !== -1; });
}

// ── Pod Manager Modal ────────────────────────────────────────
var podManagerDraft = []; // working copy during edit

var _podExpandedId = null;
var _teamMembersDraft = new Set();
function openPodManager() {
  podManagerDraft = JSON.parse(JSON.stringify(podsConfig)); // deep copy
  _podExpandedId  = null;
  // Seed the team draft (an "included" set for the checkbox UI) from the excluded-ids
  // storage, any designer not explicitly excluded shows up pre-checked, including ones
  // that were auto-created from Jira after the roster was last saved.
  _teamMembersDraft = new Set(DESIGNERS.filter(function(d){ return teamExcluded === null || !teamExcluded.has(d.id); }).map(function(d){ return d.id; }));
  renderPodManagerModal();
  var modal = document.getElementById("pod-manager-modal");
  if (modal) modal.style.display = "flex";
}
function toggleTeamMember(id) {
  if (_teamMembersDraft.has(id)) _teamMembersDraft.delete(id);
  else                            _teamMembersDraft.add(id);
  renderPodManagerModal();
}
function toggleAllTeamMembers(state) {
  _teamMembersDraft = new Set(state ? DESIGNERS.map(function(d){ return d.id; }) : []);
  renderPodManagerModal();
}
function togglePodExpanded(podId) {
  _podExpandedId = (_podExpandedId === podId) ? null : podId;
  renderPodManagerModal();
}

function closePodManager() {
  var modal = document.getElementById("pod-manager-modal");
  if (modal) modal.style.display = "none";
}

function addNewPod() {
  var nameEl = document.getElementById("pod-new-name");
  var name = nameEl ? nameEl.value.trim() : "";
  if (!name) return;
  var newId = "pod-" + Date.now();
  podManagerDraft.push({ id: newId, name: name, designers: [] });
  _podExpandedId = newId;  // auto-expand the newly created pod, collapse others
  nameEl.value = "";
  renderPodManagerModal();
}

function deletePod(podId) {
  podManagerDraft = podManagerDraft.filter(function(p){ return p.id !== podId; });
  renderPodManagerModal();
}

function toggleDesignerInPod(podId, designerId) {
  var pod = podManagerDraft.find(function(p){ return p.id === podId; });
  if (!pod) return;
  var idx = pod.designers.indexOf(designerId);
  if (idx === -1) pod.designers.push(designerId);
  else pod.designers.splice(idx, 1);
  renderPodManagerModal();
}

function savePodManager() {
  podsConfig = JSON.parse(JSON.stringify(podManagerDraft));
  savePods();
  // Persist team roster as exclusions (unchecked designers), not inclusions, so a future
  // new hire or newly-synced assignee defaults to visible instead of needing to be
  // manually re-added every time the roster changes.
  var excluded = DESIGNERS.filter(function(d){ return !_teamMembersDraft.has(d.id); }).map(function(d){ return d.id; });
  teamExcluded = excluded.length ? new Set(excluded) : null;
  saveTeamExcluded();
  if (selectedPod !== "all" && !podsConfig.find(function(p){ return p.id === selectedPod; })) {
    selectedPod = "all";
  }
  renderPodFilterBar();
  closePodManager();
  navigate(currentPage, false);
}

function renderPodManagerModal() {
  var content = document.getElementById("pod-manager-content");
  if (!content) return;

  var teamSet   = _teamMembersDraft;  // Set of designer ids on the team
  var allChecked = DESIGNERS.every(function(d){ return teamSet.has(d.id); });

  // Team roster section, decides who counts as "on my team" across the whole dashboard.
  var teamChips = DESIGNERS.map(function(d) {
    var on = teamSet.has(d.id);
    return '<label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;padding:4px 10px;border:1px solid ' + (on ? dColor(d.id) : "var(--border)") + ';border-radius:20px;background:' + (on ? dColor(d.id) + "18" : "transparent") + ';margin:3px 4px 3px 0">'
      + '<input type="checkbox" ' + (on ? "checked" : "") + ' onchange="toggleTeamMember(\'' + d.id + '\')" style="accent-color:' + dColor(d.id) + '">'
      + '<span style="width:18px;height:18px;border-radius:50%;background:' + dColor(d.id) + ';font-size:8px;font-weight:700;color:white;display:inline-flex;align-items:center;justify-content:center">' + initials(d.name) + '</span>'
      + '<span style="font-size:11px;font-weight:500;color:' + (on ? "var(--t1)" : "var(--t2)") + '">' + d.name + '</span>'
      + '</label>';
  }).join("");

  var html = '<div style="margin-bottom:18px;padding:12px 14px;background:var(--surface-2);border-radius:var(--radius-sm)">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">'
    +   '<div><div style="font-size:12px;font-weight:700;color:var(--t1)">Team members</div>'
    +   '<div style="font-size:10px;color:var(--t3)">Only checked people appear in "All Pods" and dashboard metrics · <b>' + teamSet.size + '</b> of ' + DESIGNERS.length + ' selected</div></div>'
    +   '<button onclick="toggleAllTeamMembers(' + (!allChecked) + ')" style="padding:4px 10px;font-size:10px;border:1px solid var(--border);border-radius:4px;background:var(--surface);color:var(--t2);cursor:pointer">' + (allChecked ? "Deselect all" : "Select all") + '</button>'
    + '</div>'
    + '<div style="display:flex;flex-wrap:wrap;max-height:180px;overflow-y:auto">' + teamChips + '</div>'
    + '</div>'
    + '<div style="margin-bottom:16px">'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:8px">Create a new pod</div>'
    + '<div style="display:flex;gap:8px">'
    + '<input id="pod-new-name" placeholder="Pod name, e.g. Kishore\'s Pod" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:13px;background:var(--surface);color:var(--t1)" onkeydown="if(event.key===\'Enter\')addNewPod()">'
    + '<button onclick="addNewPod()" style="padding:7px 14px;border-radius:var(--radius-sm);background:var(--accent);color:#fff;border:none;font-size:12px;font-weight:700;cursor:pointer">Add Pod</button>'
    + '</div></div>';

  if (podManagerDraft.length === 0) {
    html += '<div style="text-align:center;padding:24px;color:var(--t3);font-size:12px;border:1px dashed var(--border);border-radius:var(--radius-sm)">No pods yet, create one above to group your designers</div>';
  } else {
    html += podManagerDraft.map(function(pod) {
      var isOpen = _podExpandedId === pod.id;
      // Designers already claimed by ANOTHER pod, hide from this pod's picker
      var claimedElsewhere = {};
      podManagerDraft.forEach(function(p) {
        if (p.id !== pod.id) p.designers.forEach(function(id){ claimedElsewhere[id] = p.name; });
      });
      var available = DESIGNERS.filter(function(d){ return !claimedElsewhere[d.id]; });

      var memberChips = pod.designers.map(function(id) {
        var d = DESIGNERS.find(function(x){ return x.id === id; });
        if (!d) return "";
        return '<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px 2px 3px;background:' + dColor(d.id) + '22;border-radius:20px;font-size:11px;color:var(--t2);margin-right:4px">'
          + '<span style="width:18px;height:18px;border-radius:50%;background:' + dColor(d.id) + ';font-size:8px;font-weight:700;color:#fff;display:inline-flex;align-items:center;justify-content:center">' + initials(d.name) + '</span>'
          + d.name.split(" ")[0]
          + '</span>';
      }).join("");

      var header = '<div onclick="togglePodExpanded(\'' + pod.id + '\')" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--surface-2);border-bottom:' + (isOpen ? "1px solid var(--border)" : "none") + ';cursor:pointer">'
        + '<div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">'
        +   '<span style="font-size:11px;color:var(--t3);width:14px;text-align:center">' + (isOpen ? "▾" : "▸") + '</span>'
        +   '<span style="font-size:13px;font-weight:700;color:var(--t1)">' + pod.name + '</span>'
        +   '<span style="font-size:10px;padding:2px 8px;border-radius:10px;background:var(--accent);color:#fff;font-weight:700">' + pod.designers.length + '</span>'
        +   (!isOpen && pod.designers.length > 0 ? '<span style="font-size:11px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">,  ' + pod.designers.map(function(id){ var d = DESIGNERS.find(function(x){return x.id===id;}); return d ? d.name.split(" ")[0] : ""; }).filter(Boolean).join(", ") + '</span>' : "")
        + '</div>'
        + '<button onclick="event.stopPropagation();deletePod(\'' + pod.id + '\')" style="font-size:11px;color:var(--red);border:none;background:none;cursor:pointer;padding:4px 6px">Remove</button>'
        + '</div>';

      var body = "";
      if (isOpen) {
        body = '<div style="padding:12px 14px">'
          + (pod.designers.length > 0
              ? '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px dashed var(--border)"><div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:6px">In this pod</div>' + memberChips + '</div>'
              : "")
          + '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;margin-bottom:6px">Available to add</div>'
          + (available.length === 0
              ? '<div style="font-size:11px;color:var(--t3);padding:8px 0">All designers are already assigned to other pods.</div>'
              : '<div style="display:flex;flex-wrap:wrap;gap:8px">'
                + available.map(function(d) {
                    var checked = pod.designers.indexOf(d.id) !== -1;
                    return '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:5px 10px;border:1px solid ' + (checked ? dColor(d.id) : "var(--border)") + ';border-radius:20px;background:' + (checked ? dColor(d.id) + "18" : "transparent") + '">'
                      + '<input type="checkbox" ' + (checked ? "checked" : "") + ' onchange="toggleDesignerInPod(\'' + pod.id + '\',\'' + d.id + '\')" style="accent-color:' + dColor(d.id) + '">'
                      + '<div style="width:20px;height:20px;border-radius:50%;background:' + dColor(d.id) + ';font-size:8px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
                      + '<span style="font-size:12px;font-weight:500;color:' + (checked ? "var(--t1)" : "var(--t2)") + '">' + d.name + '</span>'
                      + '</label>';
                  }).join("")
                + '</div>')
          + '</div>';
      }

      return '<div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:10px;overflow:hidden">' + header + body + '</div>';
    }).join("");
  }

  content.innerHTML = html;
}

function filteredTickets(quarter) {
  quarter = quarter || selectedQuarter;
  // If a team roster is configured, restrict tickets to those assigned to on-team designers.
  // Otherwise (no team filter, no pod filter) include everything in the quarter.
  if ((selectedPod === "all" || !selectedPod) && teamExcluded === null) {
    return TICKETS.filter(function(t){ return t.quarter === quarter; });
  }
  var ds = filteredDesigners().map(function(d){ return d.id; });
  return TICKETS.filter(function(t){ return t.quarter === quarter && ds.includes(t.assignee); });
}

function filteredModules() {
  if (selectedPod === "all") return MODULES;
  return MODULES.filter(function(m){ return m.pod === selectedPod; });
}

// ── Helpers ──────────────────────────────────────────────────
function daysBetween(a, b) {
  const ms = new Date(b) - new Date(a);
  return Math.round(ms / 86400000);
}

// ── Ticket type helpers, shared across Exec Summary and card renders
var TYPE_COLOR = { "Feature":"#6366f1", "UX Revamp":"#8b5cf6", "Pattern":"#ec4899", "UX Signoff":"#10b981", "UX Research":"#f59e0b" };
var TYPE_ALIASES = {
  "revamp":"UX Revamp","ux revamp":"UX Revamp","ux-revamp":"UX Revamp",
  "signoff":"UX Signoff","ux signoff":"UX Signoff","ux sign-off":"UX Signoff","ux-signoff":"UX Signoff",
  "research":"UX Research","ux research":"UX Research","ux-research":"UX Research",
  "feature":"Feature","pattern":"Pattern"
};
function normalizeType(raw) {
  var s = String(raw || "").toLowerCase().trim();
  return TYPE_ALIASES[s] || (raw || "");
}
function typePill(rawType) {
  var t = normalizeType(rawType);
  if (!t) return "";
  var col = TYPE_COLOR[t] || "var(--t3)";
  return '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;background:' + col + '18;color:' + col + ';letter-spacing:.02em;text-transform:uppercase;white-space:nowrap">' + t + '</span>';
}

// Working-day helpers, excludes weekends and any date in HOLIDAYS (set in data.js, may be undefined)
function workingDaysBetween(from, to) {
  var start = new Date(from), end = new Date(to);
  if (end <= start) return 0;
  var holidays = (typeof HOLIDAYS !== "undefined" && Array.isArray(HOLIDAYS)) ? HOLIDAYS : [];
  var hset = new Set(holidays);
  var count = 0;
  var d = new Date(start);
  d.setDate(d.getDate() + 1); // exclude "from", count days remaining
  while (d <= end) {
    var dow = d.getDay();
    var iso = d.toISOString().slice(0,10);
    if (dow !== 0 && dow !== 6 && !hset.has(iso)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// Returns sprint pace context, used to color completion metrics relative to
// where the sprint should be, not just an absolute done/total ratio.
function sprintPace(qObj) {
  if (!qObj) return { expected: 0, elapsed: 0, totalWD: 0, remainingWD: 0, tooEarly: true };
  var totalWD     = workingDaysBetween(qObj.start, qObj.end);
  var elapsedWD   = workingDaysBetween(qObj.start, TODAY);
  if (elapsedWD > totalWD) elapsedWD = totalWD;
  var remainingWD = totalWD - elapsedWD;
  var expected    = totalWD ? Math.round(elapsedWD / totalWD * 100) : 0;
  return {
    expected:    expected,
    elapsed:     expected,
    totalWD:     totalWD,
    remainingWD: remainingWD,
    tooEarly:    expected < 20  // first ~20% of sprint, completion % is not meaningful yet
  };
}

// Pace-aware colour, reserves red for genuine risk (materially behind),
// keeps early-sprint metrics neutral instead of alarmingly red.
function paceColor(actualPct, expectedPct, tooEarly) {
  if (tooEarly) return "var(--t2)";               // neutral, too early to judge
  var gap = expectedPct - actualPct;
  if (gap <= 10) return "var(--green)";           // on pace or ahead
  if (gap <= 25) return "var(--amber)";           // behind but recoverable
  return "var(--red)";                            // materially behind
}
function paceLabel(actualPct, expectedPct, tooEarly) {
  if (tooEarly) return "Early, pace TBD";
  var gap = expectedPct - actualPct;
  if (gap <= 10) return "On pace";
  if (gap <= 25) return "Slightly behind";
  return "Behind pace";
}

function auditTicket(t) {
  const flags = [...(t.riskFlags || [])];
  const age = daysBetween(t.lastUpdated, TODAY);
  if (age >= 21 && !flags.includes("no-update")) flags.push("no-update");
  else if (age >= 14 && !flags.includes("stale"))   flags.push("stale");
  if ((t.dateChanges || []).length >= 2 && !flags.includes("date-drifted")) flags.push("date-drifted");
  return { ...t, riskFlags: flags };
}

function computeCapacity(designerId, quarter) {
  quarter = quarter || ACTIVE_QUARTER;
  const FACTOR = { "Done": 0, "In Review": 0.2, "In Progress": 0.6, "To Do": 1.0 };
  const tickets = TICKETS.filter(function(t){ return t.assignee === designerId && t.quarter === quarter; });
  const remaining = tickets.reduce(function(s,t){ return s + (FACTOR[t.status] !== undefined ? FACTOR[t.status] : 1) * (SIZES[t.size] || 1); }, 0);
  const total     = tickets.reduce(function(s,t){ return s + (SIZES[t.size] || 1); }, 0);
  const done      = tickets.filter(function(t){ return t.status === "Done"; }).length;
  let status = "available";
  if (remaining > CAPACITY.overloaded) status = "overloaded";
  else if (remaining > CAPACITY.at_risk) status = "at_risk";
  else if (remaining > CAPACITY.healthy) status = "healthy";
  return { total: total, done: done, remaining: Math.round(remaining), status: status, tickets: tickets };
}

function riskIcon(flags) {
  if (flags.includes("scope-change") || flags.includes("blocker")) return "🚨";
  if (flags.includes("no-update") || flags.includes("date-drifted")) return "⚠️";
  if (flags.includes("stale")) return "💤";
  return "📌";
}
function riskSev(flags) {
  if (flags.includes("scope-change") || flags.includes("blocker") || flags.includes("no-update")) return "red";
  return "amber";
}
function riskLabel(flag) {
  var map = {
    "stale": "Stale 2w+", "no-update": "No update 3w+", "date-drifted": "Dates drifted",
    "scope-change": "Scope changed", "blocker": "Blocker", "off-track": "Off track",
  };
  return map[flag] || flag;
}

function statusBadge(s) {
  var cls = { "Done": "b-done", "In Progress": "b-prog", "In Review": "b-rev", "To Do": "b-todo" };
  return '<span class="badge ' + (cls[s] || "b-todo") + '">' + s + '</span>';
}
function typeBadge(t) {
  var cls = { "New Feature": "b-feat", "Revamp": "b-rev2", "Pattern": "b-pat", "Research": "b-res", "UX Signoff": "b-sign" };
  return '<span class="badge ' + (cls[t] || "b-todo") + '">' + t + '</span>';
}
function sizeBadge(s) { return '<span class="badge b-size">' + s + '</span>'; }
function riskBadge(f) {
  var cls = riskSev([f]) === "red" ? "b-risk-r" : "b-risk-a";
  return '<span class="badge ' + cls + '">' + riskLabel(f) + '</span>';
}

function moduleById(id)   { return MODULES.find(function(m){ return m.id === id; }); }
function designerById(id) { return DESIGNERS.find(function(d){ return d.id === id; }); }

// ── Ticket flags, only TRUE risk: committed timeline not met ─
// Risk = Hi-Fi or Lo-Fi deadline passed and ticket not completed.
// Date drift is informational only (shown on card). NOT a flag.
// A missed deadline is any committed date on the ticket. Lo-Fi, Hi-Fi, or Final
// Review, not just Hi-Fi. Each is only checked while it's still actionable (e.g.
// Lo-Fi only matters before the ticket has moved past To Do).
function ticketFlags(t) {
  if (t.scope === "OUT") return [];
  var flags = [];

  // Hi-Fi committed date
  if (t.hiFiEnd === TODAY && t.status !== "Done" && t.status !== "In Review") {
    flags.push({ label:"Due Today", color:"var(--red)", reason:"Hi-Fi committed for today, not yet completed" });
  } else if (t.hiFiEnd && t.hiFiEnd < TODAY && t.status !== "Done") {
    flags.push({ label:"Overdue", color:"var(--red)", reason:"Hi-Fi was due " + t.hiFiEnd });
  }

  // Lo-Fi committed date, only relevant before the ticket has moved out of To Do.
  // Labeled distinctly from Hi-Fi's "Overdue", a ticket can be simultaneously overdue on
  // one date field and due-today on another (they're independent commitments), and an
  // unqualified "Overdue" + "Due Today" pair sitting next to a single displayed date looks
  // like a straight contradiction if you can't tell which field each one is about.
  if (t.loFiEnd === TODAY && t.status === "To Do") {
    flags.push({ label:"Lo-Fi Due Today", color:"var(--red)", reason:"Lo-Fi committed for today, not started" });
  } else if (t.loFiEnd && t.loFiEnd < TODAY && t.status === "To Do") {
    flags.push({ label:"Lo-Fi Overdue", color:"var(--red)", reason:"Lo-Fi was due " + t.loFiEnd });
  }

  // Final Review committed date, only counted when it's a real committed field from
  // Jira (finalReviewIsCommitted), not the derived "entered this stage" timestamp,
  // since a historical entry date can't sensibly be "overdue". Labeled distinctly for the
  // same reason as Lo-Fi above.
  if (t.finalReviewIsCommitted && t.finalReviewDate && t.status !== "Done") {
    if (t.finalReviewDate === TODAY) {
      flags.push({ label:"Final Review Due Today", color:"var(--red)", reason:"Final Review committed for today, not yet completed" });
    } else if (t.finalReviewDate < TODAY) {
      flags.push({ label:"Final Review Overdue", color:"var(--red)", reason:"Final Review was due " + t.finalReviewDate });
    }
  }

  // Date drift (Dates Drifted / Date Moved Today) is shown as
  // informational text on the kanban card, NOT counted as a risk flag.

  // Ongoing work that's gone quiet, a ticket can be "on track" by every committed date
  // and still be a real risk if it's In Progress/In Review and nobody has touched it in
  // weeks. This is a distinct signal from a missed deadline, so it gets its own flag
  // rather than silently being invisible to the At Risk count.
  if (t.status !== "Done" && t.status !== "To Do" && t.lastUpdated) {
    var idleDays = daysBetween(t.lastUpdated, TODAY);
    if (idleDays >= 21) {
      flags.push({ label:"No Update 3w+", color:"var(--red)", reason:"No activity since " + t.lastUpdated + " (" + idleDays + " days)" });
    } else if (idleDays >= 14) {
      flags.push({ label:"Stale 2w+", color:"var(--amber)", reason:"No activity since " + t.lastUpdated + " (" + idleDays + " days)" });
    }
  }

  // A To Do ticket can trip both the Hi-Fi and Lo-Fi overdue checks above, producing two
  // identically-labeled "Overdue" badges on the same card, dedupe by label, keeping the
  // first (most specific) reason.
  var seenLabels = new Set();
  flags = flags.filter(function(f) {
    if (seenLabels.has(f.label)) return false;
    seenLabels.add(f.label);
    return true;
  });

  return flags;
}

function designerRoadmapStatus(designerId) {
  var ts = TICKETS.filter(function(t){ return t.quarter === ACTIVE_QUARTER && t.assignee === designerId && t.scope !== "OUT"; }).map(auditTicket);
  return ts.some(function(t){ return ticketFlags(t).length > 0; }) ? "at-risk" : "on-track";
}

function designerWeeklyStatus(designerId) {
  var missed = (WEEKLY.planned || []).filter(function(t){ return t.assignee === designerId && (WEEKLY.missed || []).includes(t.key); });
  return missed.length > 0 ? "at-risk" : "on-track";
}

function toggleDesignerCard(id) {
  expandedDesignerCard = expandedDesignerCard === id ? null : id;
  if (expandedDesignerCard && !designerCardTab[id]) designerCardTab[id] = "overall";
  renderHomeActive();
  if (expandedDesignerCard) {
    setTimeout(function(){
      var el = document.getElementById("dc-expand-" + expandedDesignerCard);
      if (el) el.scrollIntoView({behavior:"smooth", block:"nearest"});
    }, 60);
  }
}

function setDesignerCardTab(id, tab) {
  designerCardTab[id] = tab;
  renderHomeActive();
}

function moduleStats(modId, quarter) {
  quarter = quarter || selectedQuarter;
  var ds = filteredDesigners().map(function(d){ return d.id; });
  var ts = TICKETS.filter(function(t){ return t.module === modId && t.quarter === quarter && ds.includes(t.assignee); }).map(auditTicket);
  var done  = ts.filter(function(t){ return t.status === "Done"; }).length;
  var risks = ts.filter(function(t){ return t.riskFlags.length > 0; }).length;
  return { total: ts.length, done: done, risks: risks, pct: ts.length ? Math.round(done / ts.length * 100) : 0 };
}

function allRiskyTickets(quarter) {
  quarter = quarter || selectedQuarter;
  return filteredTickets(quarter)
    .map(auditTicket)
    .filter(function(t){ return t.riskFlags.length > 0; })
    .sort(function(a,b){ return riskSev(b.riskFlags).localeCompare(riskSev(a.riskFlags)); });
}

function quarterStats(quarter) {
  quarter = quarter || selectedQuarter;
  var ts = filteredTickets(quarter).map(auditTicket);
  var done   = ts.filter(function(t){ return t.status === "Done"; }).length;
  var flight = ts.filter(function(t){ return t.status !== "Done" && t.status !== "To Do"; }).length;
  var risky  = ts.filter(function(t){ return t.riskFlags.length > 0; }).length;
  var pct    = ts.length ? Math.round(done / ts.length * 100) : 0;
  return { total: ts.length, done: done, flight: flight, risky: risky, pct: pct };
}

function aiStats(quarter, designerId) {
  var ts;
  if (designerId) {
    ts = TICKETS.filter(function(t){ return t.quarter === quarter && t.assignee === designerId; });
  } else {
    ts = filteredTickets(quarter);
  }
  var led = ts.filter(function(t){ return t.aiUsage === "AI Led"; }).length;
  var assisted = ts.filter(function(t){ return t.aiUsage === "AI Assisted"; }).length;
  var pct = ts.length ? Math.round((led + assisted) / ts.length * 100) : 0;
  return { total: ts.length, led: led, assisted: assisted, using: led + assisted, pct: pct };
}

// ── Navigate ─────────────────────────────────────────────────
var PAGE_TITLES = {
  home:      "Overview",
  intel:     "Intelligence",
  work:      "Work View",
  planning:  "Planning",
  risks:     "Risk Flags",
  digest:    "Weekly Digest",
  vpsync:    "Executive Summary",
};

function navigate(page, scrollTop) {
  if (scrollTop === undefined) scrollTop = true;
  currentPage = page;
  document.querySelectorAll(".page").forEach(function(el){ el.classList.remove("active"); });
  document.querySelectorAll(".nav-item").forEach(function(el){ el.classList.remove("active"); });
  var el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  var nav = document.getElementById("nav-" + page);
  if (nav) nav.classList.add("active");
  var tb = document.getElementById("topbar-title");
  if (tb) tb.textContent = PAGE_TITLES[page] || "";
  if (scrollTop) { var m = document.getElementById("main"); if (m) m.scrollTop = 0; }

  if (page === "home")      renderHome();
  if (page === "work")      renderWork();
  if (page === "planning")  renderPlanning();
  if (page === "risks")     renderRisks();
  if (page === "digest")    renderDigest();
  if (page === "vpsync")    renderVPSync();
}

// ── HOME ─────────────────────────────────────────────────────
var homeCard = null;

function setHomeCard(card) {
  homeCard = homeCard === card ? null : card;
  renderHomeActive();
  if (homeCard) {
    setTimeout(function(){
      var el = document.getElementById("home-drilldown");
      if (el) el.scrollIntoView({behavior:"smooth", block:"nearest"});
    }, 60);
  }
}

function renderHome() {
  var qObj = QUARTERS.find(function(q){ return q.id === selectedQuarter; });
  if (!qObj) { renderHomeActive(); return; }
  if (qObj.status === "completed") { renderHomeHistorical(qObj); return; }
  // Only use the "planning-mode" view (Epics Added / Confirmed In / …) when there
  // are NO real Jira tickets committed to this quarter yet. Once tickets exist,
  // treat it like any active quarter so metrics work the same way as JAS.
  if (qObj.status === "planning") {
    var hasCommitted = TICKETS.some(function(t){ return t.quarter === qObj.id && t.scope !== "OUT"; });
    if (!hasCommitted) { renderHomePlanning(qObj); return; }
  }
  renderHomeActive();
}

function quarterSelectorHtml() {
  // Sprint selector moved to the top-right of the topbar (renderTopbarSprint).
  // This stub keeps existing call sites working without rendering a duplicate control.
  return '';
}

function renderHomeActive() {
  var stats    = quarterStats();
  var riskyAll = allRiskyTickets();
  var ds       = filteredDesigners();
  var ai       = aiStats(selectedQuarter);
  var qObj     = QUARTERS.find(function(q){ return q.id === selectedQuarter; });
  var committed = qObj ? (qObj.committed || stats.total) : stats.total;
  var scopeAdded = qObj ? (qObj.scopeAdded || 0) : 0;
  var qEnd = qObj ? new Date(qObj.end) : null;
  var daysLeft = qEnd ? Math.max(0, Math.round((qEnd - new Date(TODAY)) / 86400000)) : null;
  var homePace = sprintPace(qObj);
  var wdLeft   = homePace.remainingWD;
  // "days left" colour: neutral until final stretch. Amber under 15 WD, red under 5.
  var wdColor  = wdLeft <= 5 ? "var(--red)" : wdLeft <= 15 ? "var(--amber)" : "var(--t3)";

  // Mid-sprint additions
  var midSprintTs = TICKETS.filter(function(t){ return t.quarter === selectedQuarter && t.addedMidSprint; });
  var closureThresholdDays = 30;
  var nearClosureTs = midSprintTs.filter(function(t){
    if (!qEnd || !t.addedAt) return false;
    return (qEnd - new Date(t.addedAt)) / 86400000 <= closureThresholdDays;
  });

  // At Risk: tickets with any flag from ticketFlags()
  var atRiskTickets = filteredTickets().map(auditTicket).filter(function(t){ return ticketFlags(t).length > 0; });

  var hc = paceColor(stats.pct, homePace.expected, homePace.tooEarly);
  var todo = stats.total - stats.done - stats.flight;

  function cardSel(id, accent, color) {
    var isActive = homeCard === id;
    return 'class="card stat-card" style="--stat-accent:' + accent + ';--stat-color:' + color
      + ';cursor:pointer'
      + (isActive ? ';background:var(--accent-t1);border-color:var(--accent-t3);box-shadow:0 0 0 2px var(--accent-t3)' : '')
      + '" onclick="setHomeCard(\'' + id + '\')"';
  }

  // ── Roadmap Health, small ring widget, positioned beside the This Week/Roadmap
  // toggle further down instead of a full-width row up top (was pushing content down
  // with mostly empty space now that the sprint selector lives in the topbar).
  var miniR = 12, miniC = 16, miniCirc = 2 * Math.PI * miniR;
  var miniDash = (stats.pct / 100) * miniCirc;
  // No card chrome (border/background), sits flush inline with the toggle so the row
  // reads as one clean control strip instead of two mismatched-height widgets.
  var roadmapHealthMini = '<div style="display:flex;align-items:center;gap:7px">'
    + '<div style="position:relative;width:' + (miniC*2) + 'px;height:' + (miniC*2) + 'px;flex-shrink:0">'
    + '<svg width="' + (miniC*2) + '" height="' + (miniC*2) + '" viewBox="0 0 ' + (miniC*2) + ' ' + (miniC*2) + '" style="transform:rotate(-90deg)">'
    + '<circle cx="' + miniC + '" cy="' + miniC + '" r="' + miniR + '" fill="none" stroke="var(--border)" stroke-width="3"/>'
    + '<circle cx="' + miniC + '" cy="' + miniC + '" r="' + miniR + '" fill="none" stroke="' + hc + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + miniDash.toFixed(1) + ' ' + (miniCirc - miniDash).toFixed(1) + '"/>'
    + '</svg>'
    + '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;color:' + hc + '">' + stats.pct + '%</div>'
    + '</div>'
    + '<div style="display:flex;gap:7px;font-size:11px;font-weight:500;white-space:nowrap">'
    + '<span><span style="color:var(--green);font-weight:700">' + stats.done + '</span> done</span>'
    + '<span><span style="color:var(--blue);font-weight:700">' + stats.flight + '</span> active</span>'
    + '<span><span style="color:var(--t3);font-weight:700">' + todo + '</span> todo</span>'
    + (daysLeft !== null ? '<span style="color:' + wdColor + ';font-weight:700" title="Excludes weekends' + (typeof HOLIDAYS!=="undefined"&&HOLIDAYS.length?" and public holidays":"") + '">' + wdLeft + ' working days left</span>' : '')
    + '</div>'
    + '</div>';

  // ── Row 1: 5 clean metric cards ───────────────────────────
  var deliveredPct = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  var pctColor = paceColor(deliveredPct, homePace.expected, homePace.tooEarly);

  // Small chevron in the corner is the only "this is clickable" signal, no 3rd text line,
  // so every card stays the same height regardless of whether it has a drill-down.
  function chevron(id) {
    return '<span style="position:absolute;top:12px;right:14px;font-size:11px;color:var(--t3)">' + (homeCard === id ? '▴' : '▾') + '</span>';
  }

  var row1 = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap);margin-bottom:var(--gap)">'

    // 1. Delivered, merged Committed + Completed, matching the Exec Summary card pattern
    + '<div ' + (midSprintTs.length > 0 ? cardSel("scope","var(--amber)","var(--t1)") : 'class="card stat-card" style="--stat-accent:' + pctColor + ';--stat-color:' + pctColor + '"') + '>'
    + (midSprintTs.length > 0 ? chevron("scope") : '')
    + '<div class="sc-label">Delivered</div>'
    + '<div class="sc-value" style="color:' + pctColor + '"><span style="color:var(--green)">' + stats.done + '</span><span style="color:var(--t3);font-weight:500">/</span>' + committed + '</div>'
    + '<div class="sc-sub">' + deliveredPct + '% of ' + committed + ' committed'
    +   (midSprintTs.length > 0 ? ' · <span style="color:' + (nearClosureTs.length > 0 ? 'var(--red)' : 'var(--amber)') + ';font-weight:700">+' + midSprintTs.length + ' added</span>' : '')
    + '</div>'
    + '</div>'

    // 2. At Risk
    + '<div ' + cardSel("risks","var(--red)","var(--red)") + '>'
    + (atRiskTickets.length > 0 ? chevron("risks") : '')
    + '<div class="sc-label">At Risk</div>'
    + '<div class="sc-value">' + atRiskTickets.length + '</div>'
    + '<div class="sc-sub">Missed committed deadline</div>'
    + '</div>'

    // 3. AI Tooling
    + '<div ' + cardSel("ai","var(--purple)","var(--purple)") + '>'
    + chevron("ai")
    + '<div class="sc-label">Using AI Tools</div>'
    + '<div class="sc-value" style="color:var(--purple)">' + ai.pct + '%</div>'
    + '<div class="sc-sub">' + ai.using + ' of ' + ai.total + ' tickets</div>'
    + '</div>'

    + '</div>';

  // ── Drill-down panel ─────────────────────────────────────
  var drilldown = "";
  if (homeCard) {
    var panelContent = "";
    var panelTitle   = "";
    var panelAccent  = "var(--accent)";
    var panelExtra   = "";

    if (homeCard === "risks") {
      panelTitle  = "At Risk. Committed Hi-Fi deadline passed without completion";
      panelAccent = "var(--red)";
      var riskRows = homeAtRiskViewMode === "week" ? atRiskTickets.filter(isAtRiskThisWeek) : atRiskTickets;
      panelExtra = '<div style="display:flex;border:1px solid var(--red);border-radius:var(--radius);overflow:hidden">'
        + '<button onclick="event.stopPropagation();setHomeAtRiskViewMode(\'week\')" style="padding:4px 12px;font-size:11px;font-weight:' + (homeAtRiskViewMode==="week"?"700":"400") + ';background:' + (homeAtRiskViewMode==="week"?"var(--red)":"transparent") + ';color:' + (homeAtRiskViewMode==="week"?"#fff":"var(--red)") + ';border:none;cursor:pointer">This Week</button>'
        + '<button onclick="event.stopPropagation();setHomeAtRiskViewMode(\'quarter\')" style="padding:4px 12px;font-size:11px;font-weight:' + (homeAtRiskViewMode==="quarter"?"700":"400") + ';background:' + (homeAtRiskViewMode==="quarter"?"var(--red)":"transparent") + ';color:' + (homeAtRiskViewMode==="quarter"?"#fff":"var(--red)") + ';border:none;cursor:pointer">Quarter</button>'
        + '</div>';
      // Same table pattern as the Exec Summary's At Risk drill-down, one design for the
      // same kind of content wherever it appears in the app.
      panelContent = riskRows.length === 0
        ? '<div class="empty">🎉 No risks flagged' + (homeAtRiskViewMode === "week" ? " this week" : "") + '</div>'
        : '<div class="table-wrap"><table style="table-layout:fixed;width:100%">'
          + '<colgroup><col style="width:90px"><col><col style="width:120px"><col style="width:140px"><col style="width:90px"></colgroup>'
          + '<thead><tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>Risk</th><th>Status</th></tr></thead>'
          + '<tbody>' + riskRows.map(function(t) {
              var dA = designerById(t.assignee);
              var tfl = ticketFlags(t);
              return '<tr>'
                + '<td class="ticket-key">' + t.key + '</td>'
                + '<td style="white-space:normal;line-height:1.4">' + t.summary + '</td>'
                + '<td>' + (dA ? dA.name.split(" ")[0] : (t.assignee || ", ")) + '</td>'
                + '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' + tfl.map(function(f){ return '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:' + (f.color==="var(--red)"?"#fde8e8":"#fef3c7") + ';color:' + f.color + '">' + f.label + '</span>'; }).join("") + '</div></td>'
                + '<td>' + statusBadge(t.status) + '</td>'
                + '</tr>';
            }).join("") + '</tbody></table></div>';
    }

    if (homeCard === "flight") {
      panelTitle  = "In Flight, active tickets by designer";
      panelAccent = "var(--blue)";
      var flightTs = filteredTickets().map(auditTicket).filter(function(t){ return t.status === "In Progress" || t.status === "In Review"; });
      panelContent = flightTs.length === 0
        ? '<div class="empty">No tickets in flight</div>'
        : '<div class="table-wrap"><table>'
          + '<thead><tr><th>Key</th><th>Summary</th><th>Assignee</th><th>Module</th><th>Type</th><th>Size</th><th>Status</th><th>Hi-Fi End</th></tr></thead>'
          + '<tbody>'
          + flightTs.map(function(t) {
              var d = designerById(t.assignee);
              var m = moduleById(t.module);
              return '<tr>'
                + '<td class="ticket-key">' + t.key + '</td>'
                + '<td style="max-width:200px;white-space:normal;line-height:1.4">' + t.summary + '</td>'
                + '<td>' + (d ? '<div style="display:flex;align-items:center;gap:5px"><div style="width:20px;height:20px;border-radius:50%;background:' + dColor(d.id) + ';font-size:10px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>' + d.name.split(" ")[0] + '</div>' : t.assignee) + '</td>'
                + '<td>' + (m ? m.icon + ' ' + m.name : ', ') + '</td>'
                + '<td>' + typeBadge(t.type) + '</td>'
                + '<td>' + sizeBadge(t.size) + '</td>'
                + '<td>' + statusBadge(t.status) + '</td>'
                + '<td style="color:var(--t2)">' + t.hiFiEnd + '</td>'
                + '</tr>';
            }).join("")
          + '</tbody></table></div>';
    }

    if (homeCard === "week") {
      panelTitle  = "This Week, delivered, missed, carry forward";
      panelAccent = "var(--green)";
      var deliveredItems = (WEEKLY.planned||[]).filter(function(t){ return (WEEKLY.delivered||[]).includes(t.key); });
      var missedItems    = (WEEKLY.planned||[]).filter(function(t){ return (WEEKLY.missed||[]).includes(t.key); });
      var carryItems     = WEEKLY.carryForward || [];
      function weekRow(t, accent) {
        var d = designerById(t.assignee);
        var m = moduleById(t.module);
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 16px;border-bottom:1px solid var(--bg)">'
          + '<span class="ticket-key" style="flex-shrink:0">' + t.key + '</span>'
          + '<span style="flex:1;font-size:12px;font-weight:500;color:var(--t1)">' + t.summary + '</span>'
          + (d ? '<div style="display:flex;align-items:center;gap:5px;flex-shrink:0"><div style="width:20px;height:20px;border-radius:50%;background:' + dColor(d.id) + ';font-size:10px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div><span style="font-size:12px;color:var(--t2)">' + d.name.split(" ")[0] + '</span></div>' : '')
          + (m ? '<span style="font-size:12px;color:var(--t3);flex-shrink:0">' + m.icon + ' ' + m.name + '</span>' : '')
          + '</div>';
      }
      panelContent = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--gap)">'
        + '<div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--green);padding:10px 16px;border-bottom:1px solid var(--border)">✓ Delivered (' + deliveredItems.length + ')</div>'
        + (deliveredItems.length === 0 ? '<div class="empty">None</div>' : deliveredItems.map(function(t){ return weekRow(t); }).join(""))
        + '</div>'
        + '<div style="border-left:1px solid var(--border);border-right:1px solid var(--border)">'
        + '<div style="font-size:12px;font-weight:700;color:var(--red);padding:10px 16px;border-bottom:1px solid var(--border)">✗ Missed (' + missedItems.length + ')</div>'
        + (missedItems.length === 0 ? '<div class="empty" style="color:var(--green)">All delivered 🎉</div>' : missedItems.map(function(t){ return weekRow(t); }).join(""))
        + '</div>'
        + '<div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--blue);padding:10px 16px;border-bottom:1px solid var(--border)">→ Carry Forward (' + carryItems.length + ')</div>'
        + (carryItems.length === 0 ? '<div class="empty">Nothing carrying over</div>' : carryItems.map(function(t){ return weekRow(t); }).join(""))
        + '</div>'
        + '</div>';
    }

    if (homeCard === "scope") {
      panelTitle  = "Added Mid-Sprint, scope changes after sprint locked";
      panelAccent = "var(--amber)";
      panelContent = midSprintTs.length === 0
        ? '<div class="empty">No mid-sprint additions this quarter</div>'
        : midSprintTs.map(function(t) {
            var d   = designerById(t.assignee);
            var m   = moduleById(t.module);
            var daysToEnd = qEnd ? Math.round((qEnd - new Date(t.addedAt)) / 86400000) : null;
            var isNearClosure = daysToEnd !== null && daysToEnd <= closureThresholdDays;
            return '<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 0;border-bottom:1px solid var(--bg)">'
              + '<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:' + (d ? dColor(d.id) : "var(--border)") + ';font-size:12px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">'
              + (d ? initials(d.name) : "?") + '</div>'
              + '<div style="flex:1;min-width:0">'
              + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">'
              + '<span class="ticket-key">' + t.key + '</span>'
              + '<span style="font-size:13px;font-weight:600;color:var(--t1)">' + t.summary + '</span>'
              + (isNearClosure ? '<span style="font-size:10px;font-weight:700;color:var(--red);background:#fde8e8;padding:2px 7px;border-radius:4px">⚠ Added near closure</span>' : '<span style="font-size:10px;font-weight:600;color:var(--amber);background:var(--amber-bg);padding:2px 7px;border-radius:4px">Mid-sprint add</span>')
              + '</div>'
              + '<div style="font-size:12px;color:var(--t3);margin-bottom:5px">'
              + (d ? d.name : "?") + (m ? ' &middot; ' + m.icon + ' ' + m.name : '')
              + ' &middot; Added ' + (t.addedAt || "unknown") + (daysToEnd !== null ? ' (' + daysToEnd + 'd before quarter end)' : '')
              + '</div>'
              + '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">'
              + typeBadge(t.type) + sizeBadge(t.size) + statusBadge(t.status)
              + (t.riskFlags && t.riskFlags.length ? t.riskFlags.map(function(f){ return '<span class="badge b-red">' + riskLabel(f) + '</span>'; }).join("") : '')
              + '</div>'
              + (t.comments ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.4">' + t.comments + '</div>' : '')
              + '</div>'
              + '</div>';
          }).join("");
    }

    if (homeCard === "ai") {
      panelTitle  = "AI Adoption. Team Overview";
      panelAccent = "var(--purple)";
      var teamAi  = aiStats(selectedQuarter);
      var allDs   = filteredDesigners();
      var notUsing = allDs.filter(function(d){ var dai=aiStats(selectedQuarter,d.id); return dai.using===0 && dai.total>0; });
      var teamLedPct = teamAi.total ? Math.round(teamAi.led / teamAi.total * 100) : 0;
      var teamAstPct = teamAi.total ? Math.round(teamAi.assisted / teamAi.total * 100) : 0;
      var teamManPct = 100 - teamLedPct - teamAstPct;

      // ── Team summary strip
      panelContent = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:18px">'
        + '<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:12px 14px;border-left:3px solid var(--purple)">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">Team Adoption</div>'
        + '<div style="font-size:24px;font-weight:700;color:var(--purple)">' + teamAi.pct + '%</div>'
        + '<div style="font-size:11px;color:var(--t3)">' + teamAi.using + ' of ' + teamAi.total + ' tickets use AI</div>'
        + '</div>'
        + '<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:12px 14px;border-left:3px solid var(--purple)">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">AI Led</div>'
        + '<div style="font-size:24px;font-weight:700;color:var(--purple)">' + teamAi.led + '</div>'
        + '<div style="font-size:11px;color:var(--t3)">' + teamLedPct + '% of tickets. AI-primary</div>'
        + '</div>'
        + '<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:12px 14px;border-left:3px solid var(--blue)">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">AI Assisted</div>'
        + '<div style="font-size:24px;font-weight:700;color:var(--blue)">' + teamAi.assisted + '</div>'
        + '<div style="font-size:11px;color:var(--t3)">' + teamAstPct + '% of tickets. AI-supported</div>'
        + '</div>'
        + '<div style="background:var(--surface-2);border-radius:var(--radius-sm);padding:12px 14px;border-left:3px solid ' + (notUsing.length > 0 ? 'var(--red)' : 'var(--green)') + '">'
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:4px">Not Using AI</div>'
        + '<div style="font-size:24px;font-weight:700;color:' + (notUsing.length > 0 ? 'var(--red)' : 'var(--green)') + '">' + notUsing.length + '</div>'
        + '<div style="font-size:11px;color:var(--t3)">' + (notUsing.length > 0 ? notUsing.map(function(d){return d.name.split(" ")[0];}).join(", ") : 'Everyone is using AI') + '</div>'
        + '</div>'
        + '</div>'

        // ── Team stacked bar
        + '<div style="margin-bottom:18px">'
        + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-bottom:5px">'
        + '<span>Team ticket breakdown</span>'
        + '<span style="display:flex;gap:10px">'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--purple);display:inline-block"></span>AI Led</span>'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--blue);display:inline-block"></span>AI Assisted</span>'
        + '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--border);display:inline-block"></span>Manual</span>'
        + '</span></div>'
        + '<div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden;display:flex">'
        + '<div style="width:' + teamLedPct + '%;background:var(--purple)"></div>'
        + '<div style="width:' + teamAstPct + '%;background:var(--blue)"></div>'
        + '</div>'
        + '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3);margin-top:4px">'
        + '<span>' + teamLedPct + '% AI Led · ' + teamAstPct + '% Assisted · ' + teamManPct + '% Manual</span>'
        + '<span>' + teamAi.total + ' tickets total</span>'
        + '</div></div>'

        // ── Per designer rows
        + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:8px">By Designer</div>'
        + allDs.map(function(d) {
            var dai    = aiStats(selectedQuarter, d.id);
            var ledPct = dai.total ? Math.round(dai.led / dai.total * 100) : 0;
            var astPct = dai.total ? Math.round(dai.assisted / dai.total * 100) : 0;
            var noAI   = dai.using === 0 && dai.total > 0;
            var aiColor = dai.led > 0 ? "var(--purple)" : dai.assisted > 0 ? "var(--blue)" : "var(--t3)";
            var badge = dai.led > 0
              ? '<span style="font-size:10px;font-weight:700;color:white;background:var(--purple);padding:2px 7px;border-radius:10px">AI Led</span>'
              : dai.assisted > 0
              ? '<span style="font-size:10px;font-weight:700;color:white;background:var(--blue);padding:2px 7px;border-radius:10px">Assisted</span>'
              : '<span style="font-size:10px;font-weight:700;color:var(--t3);background:var(--border);padding:2px 7px;border-radius:10px">Manual only</span>';
            return '<div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--bg)">'
              + '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:11px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
              + '<div style="min-width:110px"><div style="font-size:12px;font-weight:600">' + d.name + '</div><div style="font-size:10px;color:var(--t3)">' + (d.pod==="pod-a"?"Pod A":"Pod B") + '</div></div>'
              + '<div style="flex:1;height:7px;background:var(--bg);border-radius:4px;overflow:hidden;display:flex">'
              + '<div style="width:' + ledPct + '%;background:var(--purple)"></div>'
              + '<div style="width:' + astPct + '%;background:var(--blue)"></div>'
              + '</div>'
              + '<span style="font-size:13px;font-weight:700;color:' + aiColor + ';min-width:32px;text-align:right">' + dai.pct + '%</span>'
              + '<span style="font-size:11px;color:var(--t3);min-width:50px;text-align:right">' + dai.using + '/' + dai.total + ' tickets</span>'
              + '<div style="min-width:90px;text-align:right">' + badge + '</div>'
              + '</div>';
          }).join("");
    }

    drilldown = '<div id="home-drilldown" class="card" style="margin-bottom:var(--gap);border-color:' + panelAccent + ';overflow:hidden;animation:fadeUp .2s ease">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--surface-2);flex-wrap:wrap;gap:8px">'
      + '<span style="font-size:12px;font-weight:700;color:' + panelAccent + '">' + panelTitle + '</span>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + panelExtra
      + '<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" onclick="setHomeCard(null)">Close ✕</button>'
      + '</div>'
      + '</div>'
      + '<div style="padding:16px 18px">' + panelContent + '</div>'
      + '</div>';
  }

  // ── Designer Status Cards (static, no expand) ───────────────
  var designerCardsGrid = '<div style="margin-bottom:var(--gap)">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
    + '<div>'
    + '<div style="font-size:13px;font-weight:700;color:var(--t1)">Team Status</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-top:1px">On Track = committed milestones met · At Risk = any planned missed or milestone overdue</div>'
    + '</div></div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">'
    + ds.map(function(d) {
        var dTs = TICKETS.filter(function(t){ return t.quarter === selectedQuarter && t.assignee === d.id && t.scope !== "OUT"; }).map(auditTicket);
        var doneTs = dTs.filter(function(t){ return t.status === "Done"; });
        var atRiskDTs = dTs.filter(function(t){ return ticketFlags(t).length > 0; });
        var myWeekMissed = (WEEKLY.planned || []).filter(function(t){ return t.assignee === d.id && (WEEKLY.missed || []).includes(t.key); });
        var myWeekDelivered = (WEEKLY.planned || []).filter(function(t){ return t.assignee === d.id && (WEEKLY.delivered || []).includes(t.key); });
        var isAtRisk = atRiskDTs.length > 0 || myWeekMissed.length > 0;
        var statusColor = isAtRisk ? "var(--red)" : "var(--green)";
        var statusBg = isAtRisk ? "#fde8e8" : "#d1fae5";
        var statusLabel = isAtRisk ? "At Risk" : "On Track";

        return '<div class="card" style="overflow:hidden;border-bottom:3px solid ' + statusColor + '">'
          + '<div style="padding:14px 16px">'
          + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">'
          + '<div style="width:36px;height:36px;border-radius:50%;background:' + dColor(d.id) + ';font-size:13px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
          + '<div style="flex:1;min-width:0">'
          + '<div style="font-size:13px;font-weight:700;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + d.name + '</div>'
          + '<div style="font-size:10px;color:var(--t3)">' + (d.pod === "pod-a" ? "Pod A" : "Pod B") + '</div>'
          + '</div>'
          + '<div style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:' + statusBg + ';color:' + statusColor + ';flex-shrink:0">' + statusLabel + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:12px;font-size:11px;color:var(--t2)">'
          + '<span><strong style="color:var(--t1)">' + dTs.length + '</strong> tickets</span>'
          + '<span><strong style="color:var(--green)">' + doneTs.length + '</strong> done</span>'
          + (atRiskDTs.length > 0 ? '<span><strong style="color:var(--red)">' + atRiskDTs.length + '</strong> at risk</span>' : '')
          + (myWeekDelivered.length > 0 ? '<span style="margin-left:auto;color:var(--green)">✓ ' + myWeekDelivered.length + ' this week</span>' : '')
          + '</div>'
          + '</div>'
          + '</div>';
      }).join("")
    + '</div>'
    + '</div>';

  // No expanded designer detail, removed
  var designerDetail = "";

  // ── This Week, page-level section ───────────────────────────
  var thisWeekSection = (function() {
    var planned   = WEEKLY.planned      || [];
    var delivered = WEEKLY.delivered    || [];
    var missed    = WEEKLY.missed       || [];
    var carry     = WEEKLY.carryForward || [];

    var dIds = ds.map(function(d){ return d.id; });
    var deliveredItems = planned.filter(function(t){ return delivered.includes(t.key) && dIds.includes(t.assignee); });
    var missedItems    = planned.filter(function(t){ return missed.includes(t.key)    && dIds.includes(t.assignee); });
    var carryItems     = carry.filter(function(t){ return dIds.includes(t.assignee); });

    function weekItem(t) {
      var d = designerById(t.assignee);
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--bg)">'
        + (d ? '<div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>' : '')
        + '<span class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace;flex-shrink:0">' + t.key + '</span>'
        + '<span style="font-size:12px;color:var(--t1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.summary + '</span>'
        + (d ? '<span style="font-size:10px;color:var(--t3);flex-shrink:0">' + d.name.split(" ")[0] + '</span>' : '')
        + '</div>';
    }

    return '<div class="card" style="margin-bottom:var(--gap)">'
      + '<div style="padding:14px 18px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1)">This Week</span>'
      + '<span style="font-size:11px;color:var(--t3)">' + (WEEKLY.weekLabel || "") + '</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0">'
      + '<div style="padding:14px 16px;border-right:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px">✓ Delivered (' + deliveredItems.length + ')</div>'
      + (deliveredItems.length === 0 ? '<div style="font-size:11px;color:var(--t3)">None logged</div>' : deliveredItems.map(weekItem).join(""))
      + '</div>'
      + '<div style="padding:14px 16px;border-right:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:8px">✗ Missed (' + missedItems.length + ')</div>'
      + (missedItems.length === 0 ? '<div style="font-size:11px;color:var(--green)">All delivered ✓</div>' : missedItems.map(weekItem).join(""))
      + '</div>'
      + '<div style="padding:14px 16px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:4px">→ Still In Progress (' + carryItems.length + ')</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:8px">Started this week, not yet completed</div>'
      + (carryItems.length === 0 ? '<div style="font-size:11px;color:var(--t3)">Nothing ongoing</div>' : carryItems.map(weekItem).join(""))
      + '</div>'
      + '</div>'
      + '</div>';
  })();

  // ── View toggle (This Week | Sprint Roadmap) ─────────────
  // Honour the pod filter, filteredTickets already applies team roster + selected pod.
  var allQTs = filteredTickets(selectedQuarter).filter(function(t){ return t.scope !== "OUT"; }).map(auditTicket);
  var sprintLabel = qObj ? qObj.sprintName : selectedQuarter.toUpperCase();
  var viewToggle = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap">'
    + '<div style="display:flex;align-items:center;gap:12px">'
    +   '<div style="display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">'
    +     '<button onclick="setHomeViewMode(\'week\')" style="padding:6px 18px;font-size:12px;font-weight:' + (homeViewMode==="week"?"700":"400") + ';background:' + (homeViewMode==="week"?"var(--accent)":"var(--surface)") + ';color:' + (homeViewMode==="week"?"#fff":"var(--t2)") + ';border:none;cursor:pointer">This Week</button>'
    +     '<button onclick="setHomeViewMode(\'quarter\')" style="padding:6px 18px;font-size:12px;font-weight:' + (homeViewMode==="quarter"?"700":"400") + ';background:' + (homeViewMode==="quarter"?"var(--accent)":"var(--surface)") + ';color:' + (homeViewMode==="quarter"?"#fff":"var(--t2)") + ';border:none;cursor:pointer">' + sprintLabel + ' Roadmap</button>'
    +   '</div>'
    +   (homeViewMode === "week"
        ? '<span style="font-size:11px;color:var(--t3)">' + (WEEKLY.weekLabel || "") + '</span>'
        : '<span style="font-size:11px;color:var(--t3)">' + allQTs.length + ' tickets</span>')
    + '</div>'
    + roadmapHealthMini
    + '</div>';

  // ── Sprint Roadmap view (parallel structure to This Week) ──
  var quarterView = (function() {
    var doneTs    = allQTs.filter(function(t){ return t.status === "Done"; });
    var activeTs  = allQTs.filter(function(t){ return t.status === "In Progress" || t.status === "In Review"; });
    var todoTs    = allQTs.filter(function(t){ return t.status === "To Do"; });
    var pct       = allQTs.length ? Math.round(doneTs.length / allQTs.length * 100) : 0;
    var pctColor  = pct >= 75 ? "var(--green)" : pct >= 40 ? "var(--amber)" : "var(--red)";

    function qItem(t) {
      var d = designerById(t.assignee);
      var stage = getStage(t);
      var stagePill = '<span style="font-size:9px;font-weight:700;padding:1px 5px;border-radius:3px;background:var(--surface-2);color:var(--t3)">' + stage + '</span>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bg)">'
        + (d ? '<div style="width:20px;height:20px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:8px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>' : '')
        + '<span class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace;flex-shrink:0">' + t.key + '</span>'
        + '<span style="font-size:11px;color:var(--t1);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.summary + '</span>'
        + stagePill
        + (d ? '<span style="font-size:10px;color:var(--t3);flex-shrink:0">' + d.name.split(" ")[0] + '</span>' : '')
        + '</div>';
    }

    return '<div class="card" style="margin-bottom:var(--gap);overflow:hidden">'
      + '<div style="padding:14px 18px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:13px;font-weight:700;color:var(--t1)">' + sprintLabel + ' Roadmap</span>'
      + '<span style="font-size:11px;color:var(--t3)">' + allQTs.length + ' tickets · <span style="font-weight:700;color:' + pctColor + '">' + pct + '% delivered</span></span>'
      + '</div>'
      + '<div style="overflow-x:auto">'
      + '<div style="display:grid;grid-template-columns:repeat(3,minmax(280px,1fr));gap:0;min-width:840px">'
      + '<div style="padding:14px 16px;border-right:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;color:var(--t3);margin-bottom:4px">◦ Not Started (' + todoTs.length + ')</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:8px">Committed, work yet to begin</div>'
      + (todoTs.length === 0 ? '<div style="font-size:11px;color:var(--green)">All tickets started ✓</div>' : todoTs.map(qItem).join(""))
      + '</div>'
      + '<div style="padding:14px 16px;border-right:1px solid var(--border)">'
      + '<div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:4px">→ In Progress (' + activeTs.length + ')</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-bottom:8px">Research through Pod Review</div>'
      + (activeTs.length === 0 ? '<div style="font-size:11px;color:var(--t3)">Nothing active</div>' : activeTs.map(qItem).join(""))
      + '</div>'
      + '<div style="padding:14px 16px">'
      + '<div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:8px">✓ Delivered (' + doneTs.length + ')</div>'
      + (doneTs.length === 0 ? '<div style="font-size:11px;color:var(--t3)">None yet</div>' : doneTs.map(qItem).join(""))
      + '</div>'
      + '</div>'
      + '</div>'
      + '</div>';
  })();

  // ── Recommendations (contextual, no repeating visible data) ─
  var recosSection = "";
  var recos = [];

  // 1. Upcoming deadlines: active tickets with hi-fi date within 7 days (not done/in review)
  var sevenDaysOut = new Date(TODAY); sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
  var sevenDayStr = sevenDaysOut.toISOString().slice(0, 10);
  var upcomingTs = allQTs.filter(function(t){
    return t.hiFiEnd && t.hiFiEnd > TODAY && t.hiFiEnd <= sevenDayStr
        && t.status !== "Done" && t.status !== "In Review";
  });
  if (upcomingTs.length > 0) {
    recos.push({ cls:"amber", icon:"⏰",
      title: upcomingTs.length + " ticket" + (upcomingTs.length > 1 ? "s" : "") + " hitting hi-fi deadline this week",
      body: "These are committed for delivery within 7 days. Confirm each has moved to Pod Review, if not, raise in today's sync.",
      tickets: upcomingTs,
      action: "Verify each is in Pod Review or has a blocker logged" });
  }

  // 2. Falling behind: designer with < 40% delivery and 4+ open tickets (quarter > 40% elapsed)
  if (daysLeft !== null && qObj) {
    var qStart = new Date(qObj.start);
    var qTotal = Math.round((new Date(qObj.end) - qStart) / 86400000);
    var qElapsed = Math.round((new Date(TODAY) - qStart) / 86400000);
    var pctElapsed = qTotal > 0 ? qElapsed / qTotal : 0;
    if (pctElapsed > 0.4) {
      ds.forEach(function(d) {
        var dTs = allQTs.filter(function(t){ return t.assignee === d.id; });
        var dDone = dTs.filter(function(t){ return t.status === "Done"; }).length;
        var dOpen = dTs.filter(function(t){ return t.status !== "Done"; }).length;
        var dRate = dTs.length ? dDone / dTs.length : 1;
        if (dRate < 0.4 && dOpen >= 3) {
          recos.push({ cls:"red", icon:"📉",
            title: d.name.split(" ")[0] + " is at " + Math.round(dRate * 100) + "% delivery with " + dOpen + " tickets open",
            body: "At current pace, some Q3 commitments may not close before quarter end. Worth a 1:1 to triage what can realistically ship.",
            tickets: dTs.filter(function(t){ return t.status !== "Done"; }).slice(0, 3),
            action: "Review open scope, identify what to close, defer, or descope" });
        }
      });
    }
  }

  // 3. Stuck in To Do with tight deadline: still not started, hi-fi < 3 weeks
  var threeWeekStr = (function(){ var d = new Date(TODAY); d.setDate(d.getDate() + 21); return d.toISOString().slice(0, 10); })();
  var stuckTs = allQTs.filter(function(t){
    return t.status === "To Do" && t.hiFiEnd && t.hiFiEnd <= threeWeekStr && t.hiFiEnd > TODAY;
  });
  if (stuckTs.length > 0) {
    recos.push({ cls:"amber", icon:"🚦",
      title: stuckTs.length + " ticket" + (stuckTs.length > 1 ? "s" : "") + " not started, hi-fi due within 3 weeks",
      body: "Lo-fi needs to begin immediately for these to hit their committed hi-fi date. No buffer left for discovery.",
      tickets: stuckTs,
      action: "Confirm lo-fi kick-off date with the designer in next pod sync" });
  }

  // 4. Repeated date drift (2+ shifts), needs a committed conversation, not a flag
  var driftTs = allQTs.filter(function(t){
    return (t.dateChanges || []).length >= 2 && t.status !== "Done";
  });
  if (driftTs.length > 0) {
    recos.push({ cls:"blue", icon:"📅",
      title: driftTs.length + " ticket" + (driftTs.length > 1 ? "s have" : " has") + " moved dates 2+ times",
      body: "Repeated slippage usually signals an unresolved dependency, unclear scope, or under-estimated effort. These deserve a direct conversation, not just a date change.",
      tickets: driftTs.slice(0, 4),
      action: "Ask the designer: what needs to change for this date to hold?" });
  }

  if (recos.length > 0) {
    var clrMap = {red:"var(--red)", amber:"var(--amber)", blue:"var(--accent)"};
    recosSection = '<div style="margin-bottom:var(--gap)">'
      + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:10px">Attention Needed</div>'
      + '<div style="display:grid;grid-template-columns:repeat(' + Math.min(recos.length, 3) + ',1fr);gap:12px">'
      + recos.map(function(r) {
          var ticketBlock = "";
          if (r.tickets && r.tickets.length > 0) {
            ticketBlock = '<div style="margin-top:12px;background:var(--surface-2);border-radius:6px;padding:8px 10px">'
              + r.tickets.map(function(t) {
                  var td = designerById(t.assignee);
                  return '<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid var(--border)">'
                    + (td ? '<div style="width:16px;height:16px;border-radius:50%;flex-shrink:0;background:' + dColor(td.id) + ';font-size:7px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center">' + initials(td.name) + '</div>' : '')
                    + '<span class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace;flex-shrink:0">' + t.key + '</span>'
                    + '<span style="font-size:10px;color:var(--t2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.summary + '</span>'
                    + (td ? '<span style="font-size:10px;color:var(--t3);flex-shrink:0">' + td.name.split(" ")[0] + '</span>' : '')
                    + '</div>';
                }).join("")
              + '</div>';
          }
          return '<div class="card" style="padding:20px;border-left:3px solid ' + clrMap[r.cls] + ';display:flex;flex-direction:column">'
            + '<div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">'
            + '<span style="font-size:18px;flex-shrink:0">' + r.icon + '</span>'
            + '<span style="font-size:13px;font-weight:700;color:' + clrMap[r.cls] + ';line-height:1.35">' + r.title + '</span>'
            + '</div>'
            + '<div style="font-size:12px;color:var(--t2);line-height:1.6">' + r.body + '</div>'
            + ticketBlock
            + (r.action ? '<div style="margin-top:auto;padding-top:12px;font-size:11px;font-weight:700;color:' + clrMap[r.cls] + '">→ ' + r.action + '</div>' : '')
            + '</div>';
        }).join("")
      + '</div></div>';
  }

  var contentSection = homeViewMode === "week" ? thisWeekSection : quarterView;
  document.getElementById("home-bento").innerHTML = row1 + drilldown + viewToggle + contentSection + recosSection;
}

function renderHomeHistorical(qObj) {
  var stats    = quarterStats(qObj.id);
  var ai       = aiStats(qObj.id);
  var ds       = filteredDesigners();
  var committed   = qObj.committed  || stats.total;
  var scopeAdded  = qObj.scopeAdded || 0;

  // QoQ comparison
  var completedQs = QUARTERS.filter(function(q){ return q.status === "completed"; });
  var idx = completedQs.findIndex(function(q){ return q.id === qObj.id; });
  var priorQ = idx > 0 ? completedQs[idx - 1] : null;
  var priorStats = priorQ ? quarterStats(priorQ.id) : null;
  var qoqDelta = priorStats ? (stats.pct - priorStats.pct) : null;
  var qoqStr   = qoqDelta === null ? ", " : (qoqDelta >= 0 ? "▲ +" : "▼ ") + Math.abs(qoqDelta) + "%";
  var qoqColor = qoqDelta === null ? "var(--t3)" : qoqDelta >= 0 ? "var(--green)" : "var(--red)";

  // Per-designer rows, use explicit designerPerf if available, else compute from TICKETS
  var designerRows = ds.map(function(d) {
    var dp   = qObj.designerPerf && qObj.designerPerf.find(function(p){ return p.id === d.id; });
    var dai  = aiStats(qObj.id, d.id);
    var total, done, dropped, spilled;
    if (dp) {
      total = dp.epics; done = dp.done; dropped = dp.dropped || 0; spilled = dp.spilled || 0;
    } else {
      var ts = TICKETS.filter(function(t){ return t.quarter === qObj.id && t.assignee === d.id; });
      total = ts.length; done = ts.filter(function(t){ return t.status === "Done"; }).length;
      dropped = 0; spilled = 0;
    }
    var pct = total ? Math.round(done / total * 100) : 0;
    var pctColor = pct === 100 ? "var(--green)" : pct >= 70 ? "var(--blue)" : "var(--amber)";
    var tags = "";
    if (dropped > 0) tags += '<span style="font-size:10px;font-weight:600;color:var(--red);background:var(--red-bg,#fde8e8);padding:2px 6px;border-radius:4px;margin-left:4px">-' + dropped + ' dropped</span>';
    if (spilled > 0) tags += '<span style="font-size:10px;font-weight:600;color:var(--amber);background:#fff4ce;padding:2px 6px;border-radius:4px;margin-left:4px">-' + spilled + ' spilled</span>';
    return '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--bg)">'
      + '<div style="width:32px;height:32px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:13px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
      + '<div style="min-width:90px"><div style="font-size:13px;font-weight:700">' + d.name.split(" ")[0] + '</div><div style="font-size:10px;color:var(--t3)">' + total + ' epics</div></div>'
      + '<div style="flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden">'
      + '<div style="height:100%;border-radius:3px;width:' + pct + '%;background:' + pctColor + '"></div></div>'
      + '<span style="font-size:14px;font-weight:700;color:' + pctColor + ';min-width:38px;text-align:right">' + pct + '%</span>'
      + tags
      + (dai.pct > 0 ? '<span style="font-size:11px;color:var(--purple);font-weight:600;min-width:52px;text-align:right">' + dai.pct + '% AI</span>' : '<span style="min-width:52px"></span>')
      + '</div>';
  }).join("");

  var html = quarterSelectorHtml()

    // Dark banner
    + '<div style="background:var(--sidebar-bg);border-radius:var(--radius);padding:18px 24px;margin-bottom:var(--gap);display:flex;align-items:center;justify-content:space-between">'
    + '<div>'
    + '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Sprint Review</div>'
    + '<div style="font-size:20px;font-weight:700;color:white">' + qObj.sprintName + ' &nbsp;<span style="color:var(--t3);font-weight:400">·</span>&nbsp; ' + qObj.label + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:28px">'
    + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--green)">' + stats.pct + '%</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Completion</div></div>'
    + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:white">' + stats.done + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">Delivered</div></div>'
    + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:' + qoqColor + '">' + qoqStr + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em">vs ' + (priorQ ? priorQ.sprintName : ", ") + '</div></div>'
    + '</div></div>'

    // Stat row: committed / delivered / scope added / ai
    + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:var(--gap);margin-bottom:var(--gap)">'

    + '<div class="card stat-card" style="--stat-accent:var(--t2);--stat-color:var(--t1)">'
    + '<div class="sc-label">Committed</div><div class="sc-value" style="color:var(--t1)">' + committed + '</div>'
    + '<div class="sc-sub">epics at sprint start</div></div>'

    + (scopeAdded > 0
      ? '<div class="card stat-card" style="--stat-accent:var(--amber);--stat-color:var(--amber)">'
        + '<div class="sc-label">Added Mid-Sprint</div><div class="sc-value">+' + scopeAdded + '</div>'
        + '<div class="sc-sub">of ' + (committed + scopeAdded) + ' total epics</div></div>'
      : '<div class="card stat-card" style="--stat-accent:var(--green);--stat-color:var(--green)">'
        + '<div class="sc-label">Added Mid-Sprint</div><div class="sc-value">0</div>'
        + '<div class="sc-sub">No scope creep, clean sprint</div></div>')

    + '<div class="card stat-card" style="--stat-accent:var(--green);--stat-color:var(--green)">'
    + '<div class="sc-label">Delivered</div><div class="sc-value">' + stats.done + '</div>'
    + '<div class="sc-sub">of ' + stats.total + ' total · ' + stats.pct + '% done</div></div>'

    + '<div class="card stat-card" style="--stat-accent:' + qoqColor + ';--stat-color:' + qoqColor + '">'
    + '<div class="sc-label">vs Prior Sprint</div><div class="sc-value" style="color:' + qoqColor + '">' + qoqStr + '</div>'
    + '<div class="sc-sub">' + (priorStats ? priorQ.sprintName + ' was ' + priorStats.pct + '%' : 'First sprint on record') + '</div></div>'

    + '<div class="card stat-card" style="--stat-accent:var(--purple);--stat-color:var(--purple)">'
    + '<div class="sc-label">AI Adoption</div><div class="sc-value" style="color:var(--purple)">' + ai.pct + '%</div>'
    + '<div class="sc-sub">' + ai.led + ' AI Led · ' + ai.assisted + ' Assisted</div></div>'
    + '</div>'

    // Cutline note
    + (qObj.cutlineNote ? '<div style="display:flex;align-items:flex-start;gap:10px;background:var(--surface-2,var(--bg));border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:var(--gap)">'
        + '<span style="font-size:14px;flex-shrink:0">📋</span>'
        + '<div><div style="font-size:11px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Sprint Cutline Note</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.5">' + qObj.cutlineNote + '</div></div></div>' : "")

    // Designer only (module completion omitted. TICKETS are all Done so it would show 100% regardless of drops)
    + '<div class="card" style="padding:18px 20px">'
    + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);margin-bottom:12px">Designer Performance</div>'
    + designerRows + '</div>';

  document.getElementById("home-bento").innerHTML = html;
}

function renderHomePlanning(qObj) {
  var q4       = PLANNING_TICKETS.filter(function(p){ return p.cutline !== "OUT"; });
  var in4      = q4.filter(function(p){ return p.cutline === "IN"; });
  var tbd4     = q4.filter(function(p){ return p.cutline === "TBD"; });
  var noPRD4   = q4.filter(function(p){ return !p.prdReady; });
  var noPrd    = q4.length - q4.filter(function(p){ return p.prdReady; }).length;

  function planBadge(c) {
    var cls = {IN:"b-cut-in", OUT:"b-cut-out", TBD:"b-cut-tbd"}[c] || "b-out";
    return '<span class="badge ' + cls + '">' + c + '</span>';
  }

  var statRow = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap);margin-bottom:var(--gap)">'
    + '<div class="card stat-card" style="--stat-accent:var(--t2);--stat-color:var(--t1)"><div class="sc-label">Epics Added</div><div class="sc-value" style="color:var(--t1)">' + q4.length + '</div><div class="sc-sub">PM-queued for next sprint</div></div>'
    + '<div class="card stat-card" style="--stat-accent:var(--green);--stat-color:var(--green)"><div class="sc-label">Confirmed IN</div><div class="sc-value">' + in4.length + '</div><div class="sc-sub">cutline locked</div></div>'
    + '<div class="card stat-card" style="--stat-accent:var(--amber);--stat-color:var(--amber)"><div class="sc-label">Evaluating</div><div class="sc-value">' + tbd4.length + '</div><div class="sc-sub">TBD, needs decision</div></div>'
    + '<div class="card stat-card" style="--stat-accent:' + (noPrd > 0 ? 'var(--red)' : 'var(--green)') + ';--stat-color:' + (noPrd > 0 ? 'var(--red)' : 'var(--green)') + '"><div class="sc-label">No PRD Yet</div><div class="sc-value">' + noPrd + '</div><div class="sc-sub">' + (noPrd > 0 ? 'Needs PRD before cutline' : 'All epics have PRD') + '</div></div>'
    + '</div>';

  var items = q4.map(function(p) {
    var da  = DESIGNERS.find(function(d){ return d.id === p.tentativeAssignee; });
    var mod = MODULES.find(function(m){ return m.id === p.module; }) || { name: p.module, icon: "" };
    var flags = [];
    if (!p.prdReady)          flags.push('<span class="badge" style="background:var(--red-bg);color:var(--red);border-color:var(--red)">No PRD</span>');
    if (!p.tentativeAssignee) flags.push('<span class="badge" style="background:var(--amber-bg);color:var(--amber);border-color:var(--amber)">Unassigned</span>');
    var rowBg = !p.prdReady ? 'background:var(--red-bg,#fff5f5)' : '';
    return '<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 20px;border-bottom:1px solid var(--border);' + rowBg + '">'
      + '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:' + (da ? dColor(da.id) : "var(--border)") + ';font-size:10px;font-weight:700;color:' + (da ? '#fff' : 'var(--t3)') + ';display:flex;align-items:center;justify-content:center;margin-top:2px">'
      + (da ? initials(da.name) : "?") + '</div>'
      + '<div style="flex:1;min-width:0">'
      + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">'
      + '<span class="pi-key">' + p.key + '</span>'
      + '<span style="font-size:13px;font-weight:700">' + p.summary + '</span>'
      + planBadge(p.cutline)
      + '</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-bottom:6px">'
      + mod.icon + ' ' + mod.name + ' &middot; ' + (da ? da.name : '<span style="color:var(--amber);font-weight:500">Unassigned</span>')
      + '</div>'
      + '<div class="pi-chips">' + flags.join("") + '</div>'
      + (p.comments ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.4">' + p.comments + '</div>' : '')
      + '</div></div>';
  }).join("");

  var list = '<div class="card" style="margin-bottom:var(--gap)">'
    + '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
    + '<span style="font-size:14px;font-weight:700">' + qObj.sprintName + ' Pipeline</span>'
    + '<span class="badge b-prog">' + q4.length + ' epics</span>'
    + (noPRD4.length > 0 ? '<span class="badge" style="background:var(--red);color:#fff;border-color:var(--red);margin-left:4px">' + noPRD4.length + ' need PRD</span>' : '')
    + '</div>'
    + (q4.length === 0 ? '<div class="empty">No pipeline items yet</div>' : items)
    + '</div>';

  document.getElementById("home-bento").innerHTML = quarterSelectorHtml() + statRow + list;
}

// ── INTELLIGENCE ─────────────────────────────────────────────
function setIntelTab(tab) {
  intelTab = tab;
  renderIntel();
}

function scrollRecoCarousel(dir) {
  var track = document.getElementById('reco-track');
  if (!track) return;
  var card = track.querySelector('[style*="min-width"]');
  var cardW = card ? card.offsetWidth + 12 : 252; // card width + gap
  track.scrollBy({ left: dir * cardW, behavior: 'smooth' });
}

function toggleIntelDesigner(id) {
  expandedIntelDesigner = expandedIntelDesigner === id ? null : id;
  renderIntel();
}

function renderIntel() {
  // Intelligence is always locked to the active sprint, no mixing with upcoming
  var intelQuarter = ACTIVE_QUARTER;
  var activeQObj = QUARTERS.find(function(q){ return q.id === ACTIVE_QUARTER; });
  var ds  = filteredDesigners();
  var caps = ds.map(function(d){ return { d:d, cap:computeCapacity(d.id, intelQuarter) }; });
  var overloaded = caps.filter(function(x){ return x.cap.status === "overloaded"; });
  var avail      = caps.filter(function(x){ return x.cap.status === "available" || x.cap.status === "healthy"; });
  var hasWarnings = PLANNING_TICKETS.some(function(p){ return p.cutline === "IN"; });

  function barColor(s){ return {overloaded:"var(--red)",at_risk:"var(--red)",healthy:"var(--green)",available:"var(--green)"}[s]; }
  function chipCls(s) { return {overloaded:"chip-overloaded",at_risk:"chip-atrisk",healthy:"chip-healthy",available:"chip-healthy"}[s]; }
  function chipLbl(s) { return {overloaded:"Overloaded",at_risk:"At Risk",healthy:"Healthy",available:"Light"}[s]; }

  // ── Compact scalable designer rows ──────────────────────────
  var designerRows = caps.map(function(x) {
    var d = x.d; var cap = x.cap;
    var isOpen  = expandedIntelDesigner === d.id;
    var pct     = Math.min(100, Math.round(cap.remaining / 50 * 100));
    var flagged = cap.tickets.map(auditTicket).filter(function(t){ return t.riskFlags.length > 0; });
    var open    = cap.tickets.filter(function(t){ return t.status !== "Done"; });

    var row = '<div class="card" style="overflow:hidden;margin-bottom:8px">'
      // Header row, always visible, click to expand
      + '<div onclick="toggleIntelDesigner(\'' + d.id + '\')" style="display:flex;align-items:center;gap:12px;padding:14px 18px;cursor:pointer;transition:background .1s" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'\'">'
      + '<div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:14px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
      + '<div style="min-width:110px"><div style="font-size:14px;font-weight:700">' + d.name + '</div><div style="font-size:10px;color:var(--t3)">' + (d.pod==="pod-a"?"Pod A · Kiran Desai":"Pod B · Meera Pillai") + '</div></div>'
      // Bar
      + '<div style="flex:1;height:8px;background:var(--bg);border-radius:4px;overflow:hidden">'
      + '<div style="height:100%;border-radius:4px;width:' + pct + '%;background:' + barColor(cap.status) + '"></div></div>'
      // Stats
      + '<div style="display:flex;align-items:center;gap:16px;flex-shrink:0">'
      + '<div style="text-align:right"><div style="font-size:16px;font-weight:700;color:' + barColor(cap.status) + '">' + cap.remaining + 'd</div><div style="font-size:10px;color:var(--t3)">remaining</div></div>'
      + '<span class="im-chip ' + chipCls(cap.status) + '">' + chipLbl(cap.status) + '</span>'
      + '<div style="text-align:center"><div style="font-size:14px;font-weight:700;color:var(--green)">' + cap.done + '</div><div style="font-size:10px;color:var(--t3)">done</div></div>'
      + '<div style="text-align:center"><div style="font-size:14px;font-weight:700;color:' + (open.length>0?"var(--blue)":"var(--t3)") + '">' + open.length + '</div><div style="font-size:10px;color:var(--t3)">open</div></div>'
      + (flagged.length > 0 ? '<div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:var(--red-bg);border-radius:20px;flex-shrink:0"><span style="font-size:12px;color:var(--red);font-weight:700">⚠ ' + flagged.length + ' flag' + (flagged.length>1?'s':'') + '</span></div>' : '')
      + '<div style="font-size:16px;color:var(--t3);width:16px;text-align:center">' + (isOpen ? '↑' : '↓') + '</div>'
      + '</div></div>';

    // Expanded: tickets needing attention first, then all open
    if (isOpen) {
      var needsUpdate = flagged.length > 0
        ? '<div style="padding:0 18px 10px">'
          + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--red);margin-bottom:8px">⚠ Needs Attention</div>'
          + flagged.map(function(t) {
              var age = daysBetween(t.lastUpdated, TODAY);
              return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--red-bg);border-radius:var(--radius-sm);margin-bottom:6px">'
                + '<span class="ticket-key">' + t.key + '</span>'
                + '<span style="flex:1;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + t.summary + '</span>'
                + statusBadge(t.status)
                + '<span style="font-size:12px;color:var(--t2);flex-shrink:0">' + age + 'd ago</span>'
                + t.riskFlags.map(riskBadge).join("")
                + '</div>';
            }).join("")
          + '</div>'
        : '';

      var allOpenRows = open.filter(function(t){ return !auditTicket(t).riskFlags.length; }).map(function(t){
        return '<tr>'
          + '<td class="ticket-key">' + t.key + '</td>'
          + '<td style="max-width:240px;white-space:normal">' + t.summary + '</td>'
          + '<td>' + typeBadge(t.type) + '</td>'
          + '<td>' + sizeBadge(t.size) + '</td>'
          + '<td>' + statusBadge(t.status) + '</td>'
          + '<td style="color:var(--t2)">' + t.hiFiEnd + '</td>'
          + '</tr>';
      }).join("");

      row += needsUpdate
        + (allOpenRows ? '<div style="border-top:1px solid var(--bg)">'
            + '<div style="padding:10px 18px 6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">All Open</div>'
            + '<div class="table-wrap"><table>'
            + '<thead><tr><th>Key</th><th>Summary</th><th>Type</th><th>Size</th><th>Status</th><th>Hi-Fi End</th></tr></thead>'
            + '<tbody>' + allOpenRows + '</tbody></table></div></div>' : '');
    }

    row += '</div>';
    return row;
  }).join("");

  // ── Sprint Pulse ──────────────────────────────────────────
  var sprintStart    = activeQObj ? activeQObj.start : null;
  var sprintEnd      = activeQObj ? activeQObj.end   : null;
  var totalSprintDays   = (sprintStart && sprintEnd) ? daysBetween(sprintStart, sprintEnd) : 91;
  var elapsedDays       = sprintStart ? Math.max(0, daysBetween(sprintStart, TODAY)) : 0;
  var remainingSprintD  = Math.max(0, totalSprintDays - elapsedDays);
  var timePct           = Math.round(elapsedDays / totalSprintDays * 100);
  var allQTs            = filteredTickets(intelQuarter);
  var doneQTs           = allQTs.filter(function(t){ return t.status === "Done"; }).length;
  var completionPct     = allQTs.length ? Math.round(doneQTs / allQTs.length * 100) : 0;
  var weekVelocity      = (WEEKLY.delivered || []).length;
  var riskyQTs          = allRiskyTickets(intelQuarter);
  var riskDensity       = allQTs.length ? Math.round(riskyQTs.length / allQTs.length * 100) : 0;
  // Pace: are we completing work faster than time is passing?
  var paceRatio         = timePct > 0 ? (completionPct / timePct) : 1;
  var paceSignal        = paceRatio >= 1.1 ? { label:"Ahead of pace", color:"var(--green)", icon:"↑" }
                        : paceRatio >= 0.8 ? { label:"On track", color:"var(--blue)", icon:"→" }
                        : { label:"Behind pace", color:"var(--red)", icon:"↓" };

  function pulseCard(label, value, sub, barPct, barColor) {
    return '<div class="card" style="padding:14px 16px;flex:1">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);margin-bottom:6px">' + label + '</div>'
      + '<div style="font-size:20px;font-weight:700;color:var(--t1);line-height:1;margin-bottom:4px">' + value + '</div>'
      + '<div style="font-size:12px;color:var(--t2);margin-bottom:8px">' + sub + '</div>'
      + (barPct !== undefined ? '<div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden"><div style="height:100%;width:' + barPct + '%;background:' + barColor + ';border-radius:2px"></div></div>' : '')
      + '</div>';
  }

  var riskCount = riskyQTs.length;
  var sprintPulse = '<div style="display:flex;gap:var(--gap);margin-bottom:16px">'
    + pulseCard("Sprint Timeline", remainingSprintD + "d left", elapsedDays + "d elapsed · " + timePct + "% through", timePct, "var(--accent)")
    + pulseCard("Delivery", completionPct + "%", doneQTs + " of " + allQTs.length + " tickets done", completionPct, completionPct >= 75 ? "var(--green)" : completionPct >= 50 ? "var(--accent)" : "var(--red)")
    + pulseCard("This Week", weekVelocity + " delivered", WEEKLY.missed.length + " missed · " + WEEKLY.carryForward.length + " carrying forward", undefined, undefined)
    + pulseCard("Flags", riskCount + " ticket" + (riskCount !== 1 ? "s" : ""), riskCount === 0 ? "No issues, all clear" : "need attention before sprint end", riskCount === 0 ? 0 : Math.min(100, Math.round(riskCount / allQTs.length * 100)), riskCount === 0 ? "var(--green)" : "var(--red)")
    + '</div>';

  // ── Recommendations carousel ──────────────────────────────
  var recos = [];
  // Bandwidth: only flag when ALL sprint tickets are Done and meaningful days remain
  var fullyFree = caps.filter(function(x){
    return x.cap.tickets.length > 0
      && x.cap.tickets.every(function(t){ return t.status === "Done"; })
      && remainingSprintD > 7;
  });
  if (overloaded.length > 0 && fullyFree.length > 0) {
    recos.push({ cls:"red", icon:"🔥",
      title: overloaded.map(function(x){return x.d.name.split(" ")[0];}).join(" & ") + (overloaded.length===1?" is":" are") + " overloaded",
      body: "Consider moving scope to " + fullyFree.map(function(x){return x.d.name.split(" ")[0];}).join(" or ") + ", who " + (fullyFree.length===1?"has":"have") + " finished all sprint tickets." });
  } else if (overloaded.length > 0) {
    recos.push({ cls:"red", icon:"🔥",
      title: overloaded.map(function(x){return x.d.name.split(" ")[0];}).join(" & ") + (overloaded.length===1?" is":" are") + " overloaded",
      body: "Above capacity threshold, no one on the team has fully cleared their sprint yet. Review scope with pod manager." });
  }
  if (fullyFree.length > 0) {
    fullyFree.forEach(function(x) {
      recos.push({ cls:"green", icon:"✅",
        title: x.d.name.split(" ")[0] + ", sprint complete",
        body: "All " + x.cap.tickets.length + " tickets done. " + remainingSprintD + "d left in sprint, available for new scope or cross-pod support." });
    });
  }
  var riskyN = riskyQTs.length;
  if (riskyN > 0) {
    var topStale = riskyQTs.slice(0,2).map(function(t){ return t.key; }).join(", ");
    recos.push({ cls:"blue", icon:"🎯",
      title: riskyN + " ticket" + (riskyN!==1?"s":"") + " need a Jira update",
      body: riskyN + " items flagged (" + topStale + "…). Stale status leads to bad sprint reports, a quick update per designer keeps this clean." });
  }
  if (riskDensity > 30) {
    recos.push({ cls:"red", icon:"📡",
      title: riskDensity + "% of sprint is flagged",
      body: riskyN + " of " + allQTs.length + " tickets have risk flags. Consider a pod sync, this looks like a scope or timeline issue, not just individual updates." });
  }
  if (weekVelocity === 0) {
    recos.push({ cls:"red", icon:"⚠️",
      title: "No deliveries this week",
      body: "Zero tickets closed in the past 7 days. Check if work is stuck in review or blocked upstream." });
  }

  // dot-grid decoration used on each card (matches Darwinbox card reference)
  var dotGrid = '<svg width="64" height="48" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:.18;display:block">'
    + (function(){
        var d=""; var cols=5, rows=4, cx=8, cy=8, gap=13;
        for(var r=0;r<rows;r++) for(var c=0;c<cols;c++)
          d+='<circle cx="'+(cx+c*gap)+'" cy="'+(cy+r*gap)+'" r="2.5" fill="currentColor"/>';
        return d;
      })()
    + '</svg>';

  var bgMap  = {red:"var(--red-bg)",  green:"var(--green-bg)",  blue:"var(--accent-t1)", amber:"var(--amber-bg)"};
  var clrMap = {red:"var(--red)",     green:"var(--green)",     blue:"var(--accent)",    amber:"var(--amber)"};

  var recosHtml = "";
  if (recos.length > 0) {
    var cards = recos.map(function(r, i) {
      return '<div style="'
        + 'min-width:240px;max-width:260px;flex-shrink:0;'
        + 'background:var(--surface);border:1px solid var(--border);border-radius:12px;'
        + 'scroll-snap-align:start;overflow:hidden;position:relative;cursor:default'
        + '">'
        // top row: icon + dismiss
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;padding:16px 16px 0">'
        + '<div style="width:40px;height:40px;border-radius:10px;background:' + bgMap[r.cls] + ';display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">' + r.icon + '</div>'
        + '<button onclick="this.closest(\'[data-reco]\').style.display=\'none\'" style="width:24px;height:24px;border-radius:50%;border:none;background:var(--surface-2);color:var(--t3);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0" title="Dismiss">✕</button>'
        + '</div>'
        // title + body
        + '<div style="padding:12px 16px 0">'
        + '<div style="font-size:14px;font-weight:700;color:var(--t1);line-height:1.4;margin-bottom:6px">' + r.title + '</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6">' + r.body + '</div>'
        + '</div>'
        // accent line at bottom-left + dot grid at bottom-right
        + '<div style="display:flex;align-items:flex-end;justify-content:space-between;padding:12px 0 0 0;margin-top:4px">'
        + '<div style="height:3px;width:32px;background:' + clrMap[r.cls] + ';border-radius:0 2px 2px 0;margin-left:16px;margin-bottom:16px"></div>'
        + '<div style="color:' + clrMap[r.cls] + ';margin-right:8px">' + dotGrid + '</div>'
        + '</div>'
        + '</div>';
    }).join("");

    // Left panel (title + sprint context)
    var leftPanel = '<div style="'
      + 'min-width:160px;max-width:180px;flex-shrink:0;'
      + 'background:var(--accent-t1);'
      + 'border:1px solid var(--accent-t2);border-radius:12px;'
      + 'display:flex;flex-direction:column;justify-content:flex-end;padding:18px 16px;'
      + 'position:relative;overflow:hidden'
      + '">'
      + '<div style="font-size:32px;margin-bottom:8px">💡</div>'
      + '<div style="font-size:14px;font-weight:700;color:var(--accent);line-height:1.35">Recommendations<br>for This Sprint</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:4px">' + recos.length + ' insight' + (recos.length!==1?"s":"") + '</div>'
      + '</div>';

    recosHtml = '<div style="margin-top:20px">'
      // outer card wrapping both panels
      + '<div style="background:var(--surface-2);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:12px">'
      // row: left panel + scrollable cards
      + '<div style="display:flex;gap:12px;align-items:stretch">'
      + leftPanel
      + '<div id="reco-track" style="'
      + 'display:flex;gap:12px;overflow-x:scroll;scroll-snap-type:x mandatory;'
      + '-ms-overflow-style:none;scrollbar-width:none;flex:1;'
      + '">'
      + cards
      + '</div>'
      + '</div>'
      // nav row
      + '<div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">'
      + '<button onclick="scrollRecoCarousel(-1)" style="width:30px;height:30px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--t2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">←</button>'
      + '<button onclick="scrollRecoCarousel(1)"  style="width:30px;height:30px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--t2);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center">→</button>'
      + '</div>'
      + '</div>'
      + '</div>';
  }


  // ── AI Literacy section, per-designer breakdown + QoQ ──
  var teamAi   = aiStats(intelQuarter);
  var prevQ    = QUARTERS.filter(function(q){ return q.status === "completed"; }).slice(-1)[0];
  var prevQObj = prevQ || null;

  function aiCategoryRow(label, count, total, color, bgColor) {
    var pct = total ? Math.round(count / total * 100) : 0;
    return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0">'
      + '<div style="width:8px;height:8px;border-radius:2px;flex-shrink:0;background:' + color + '"></div>'
      + '<div style="min-width:80px;font-size:12px;font-weight:500;color:var(--t2)">' + label + '</div>'
      + '<div style="flex:1;height:6px;background:var(--bg);border-radius:3px;overflow:hidden">'
      + '<div style="height:100%;border-radius:3px;width:' + pct + '%;background:' + color + ';opacity:' + (count === 0 ? '0.25' : '1') + '"></div></div>'
      + '<div style="min-width:24px;text-align:right;font-size:12px;font-weight:700;color:' + (count > 0 ? color : 'var(--t3)') + '">' + count + '</div>'
      + '<div style="min-width:34px;text-align:right;font-size:12px;color:var(--t3)">' + pct + '%</div>'
      + '</div>';
  }

  var aiCards = ds.map(function(d) {
    var dai      = aiStats(intelQuarter, d.id);
    var manual   = dai.total - dai.led - dai.assisted;
    var daiPrev  = prevQObj ? aiStats(prevQObj.id, d.id) : null;
    var delta    = daiPrev ? (dai.pct - daiPrev.pct) : null;
    var deltaStr = delta === null ? null : (delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '→ ') + Math.abs(delta) + '%';
    var deltaColor = delta === null ? 'var(--t3)' : delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--t3)';
    var topLabel = dai.led > 0 ? 'AI Led' : dai.assisted > 0 ? 'AI Assisted' : 'Manual';
    var topColor = dai.led > 0 ? 'var(--purple)' : dai.assisted > 0 ? 'var(--blue)' : 'var(--t3)';

    return '<div class="card" style="padding:18px 20px">'
      // Header
      + '<div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border)">'
      + '<div style="width:40px;height:40px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:14px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
      + '<div style="flex:1">'
      + '<div style="font-size:14px;font-weight:700">' + d.name + '</div>'
      + '<div style="font-size:10px;color:var(--t3)">' + (d.pod==="pod-a"?"Pod A":"Pod B") + '</div>'
      + '</div>'
      + '<div style="text-align:right">'
      + '<div style="font-size:20px;font-weight:700;color:' + topColor + '">' + dai.pct + '%</div>'
      + '<div style="font-size:10px;font-weight:700;color:' + topColor + '">' + topLabel + '</div>'
      + '</div>'
      + '</div>'
      // Three category rows
      + aiCategoryRow('AI Led', dai.led, dai.total, 'var(--purple)', 'var(--purple-bg)')
      + aiCategoryRow('AI Assisted', dai.assisted, dai.total, 'var(--blue)', 'var(--blue-bg)')
      + aiCategoryRow('Manual', manual, dai.total, 'var(--t3)', 'var(--surface-2)')
      // QoQ footer
      + '<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      + '<span style="font-size:10px;color:var(--t3)">' + (prevQObj ? 'vs ' + prevQObj.sprintName + ': ' + (daiPrev ? daiPrev.pct + '% AI usage' : ', ') : 'No prior sprint data') + '</span>'
      + (deltaStr ? '<span style="font-size:12px;font-weight:700;color:' + deltaColor + '">' + deltaStr + '</span>' : '')
      + '</div>'
      + '</div>';
  }).join("");

  // Team-level summary bar
  var teamLed      = ds.reduce(function(s,d){ return s + aiStats(intelQuarter,d.id).led; }, 0);
  var teamAssisted = ds.reduce(function(s,d){ return s + aiStats(intelQuarter,d.id).assisted; }, 0);
  var teamTotal    = ds.reduce(function(s,d){ return s + aiStats(intelQuarter,d.id).total; }, 0);
  var teamManual   = teamTotal - teamLed - teamAssisted;
  var prevTeamAi   = prevQObj ? aiStats(prevQObj.id) : null;
  var teamDelta    = prevTeamAi ? (teamAi.pct - prevTeamAi.pct) : null;

  var aiSection = '<div>'
    // Team summary strip
    + '<div class="card" style="padding:16px 20px;margin-bottom:var(--gap)">'
    + '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">'
    + '<div><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);margin-bottom:4px">Team AI Adoption · ' + (activeQObj ? activeQObj.sprintName : intelQuarter) + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:8px">'
    + '<span style="font-size:24px;font-weight:700;color:var(--purple)">' + teamAi.pct + '%</span>'
    + '<span style="font-size:12px;color:var(--t2)">using AI this sprint</span>'
    + (teamDelta !== null ? '<span style="font-size:14px;font-weight:700;color:' + (teamDelta>=0?"var(--green)":"var(--red)") + '">' + (teamDelta>=0?'▲ +':'▼ ') + Math.abs(teamDelta) + '% vs ' + prevQObj.sprintName + '</span>' : '')
    + '</div></div>'
    + '<div style="display:flex;gap:20px;margin-left:auto">'
    + '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--purple)">' + teamLed + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">AI Led</div></div>'
    + '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--blue)">' + teamAssisted + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">AI Assisted</div></div>'
    + '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--t3)">' + teamManual + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Manual</div></div>'
    + '<div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--t1)">' + teamTotal + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Total</div></div>'
    + '</div>'
    + '</div>'
    // Stacked team bar
    + '<div style="height:6px;border-radius:3px;overflow:hidden;display:flex;margin-top:14px">'
    + '<div style="width:' + Math.round(teamLed/teamTotal*100) + '%;background:var(--purple)"></div>'
    + '<div style="width:' + Math.round(teamAssisted/teamTotal*100) + '%;background:var(--blue)"></div>'
    + '<div style="flex:1;background:var(--border)"></div>'
    + '</div>'
    + '<div style="display:flex;gap:16px;margin-top:6px;font-size:10px;color:var(--t3)">'
    + '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--purple);margin-right:4px"></span>AI Led</span>'
    + '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--blue);margin-right:4px"></span>AI Assisted</span>'
    + '<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--border);margin-right:4px"></span>Manual</span>'
    + '</div>'
    + '</div>'
    // Per-designer 2-col grid
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--gap)">'
    + aiCards
    + '</div>'
    + '</div>';

  var sprintLock = '<div style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;background:var(--accent-t1);border:1px solid var(--accent-t3);font-size:12px;font-weight:700;color:var(--accent);margin-bottom:16px">'
    + '🔒 Locked to active sprint: ' + (activeQObj ? activeQObj.sprintName : ACTIVE_QUARTER) + '</div>';

  // ── Tab bar ──────────────────────────────────────────────
  var tabs = '<div class="sds-tab-row">'
    + '<button class="sds-tab' + (intelTab==="workload"?" active":"") + '" onclick="setIntelTab(\'workload\')">'
    + '<span class="tab-dot" style="background:var(--blue)"></span>Workload & Capacity</button>'
    + '<button class="sds-tab' + (intelTab==="ai"?" active":"") + '" onclick="setIntelTab(\'ai\')">'
    + '<span class="tab-dot" style="background:var(--purple)"></span>AI Literacy</button>'
    + '</div>';

  // ── Panel: Workload & Capacity ───────────────────────────
  var workloadPanel = '<div class="sds-panel' + (intelTab==="workload"?" active":"") + '">'
    + sprintPulse + designerRows + recosHtml
    + '</div>';

  // ── Panel: AI Literacy ───────────────────────────────────
  var aiPanel = '<div class="sds-panel' + (intelTab==="ai"?" active":"") + '">'
    + aiSection
    + '</div>';

  var intelHtml = sprintLock + tabs + workloadPanel + aiPanel;
  var target = document.getElementById("intel-content");
  if (target) target.innerHTML = intelHtml;
  return intelHtml;
}

function renderIntelInto(containerId, append) {
  var html = renderIntel();
  var el = document.getElementById(containerId);
  if (!el || !html) return;
  var wrapper = '<div style="margin-top:var(--gap);border-top:1px solid var(--border);padding-top:var(--gap)">'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--t3);margin-bottom:12px">Workload & Intelligence</div>'
    + html + '</div>';
  if (append) el.innerHTML += wrapper;
  else el.innerHTML = wrapper;
}

// ── WORK VIEW (By Designer) ───────────────────────────────────
var expandedDesigner = null;

function renderWork() {
  var el = document.getElementById("work-content");
  if (!el) return;

  var body = buildDesignerView();

  // Negative margin breaks the kanban out of page padding to go edge-to-edge, the -20px
  // top also cancels .page's top padding so the toolbar sits flush under the pod filter
  // bar instead of leaving a blank gap that made the toolbar's border look like a second,
  // floating divider.
  el.innerHTML = '<div style="margin:-20px -24px -12px">' + body + '</div>';
}

// ── Work View designer filter ────────────────────────────────
function setWorkDesignerFilter(id) {
  workDesignerFilter = id;
  renderWork();
}

// ── Designer view. Kanban board with designer selector ───────
// ── Workflow stage helper ─────────────────────────────────────
function getStage(t) {
  if (t.stage) return t.stage;
  if (t.status === "Done")      return "Done";
  if (t.status === "In Review") return "POD REVIEW";
  if (t.status === "To Do")     return "TO DO";
  // In Progress, derive by type then dates
  if (t.type === "Research")    return "RESEARCH";
  if (t.type === "UX Signoff")  return "UX IN PROGRESS";
  if (t.loFiEnd && t.loFiEnd > TODAY) return "LO-FI";
  return "HI-FI";
}

// Stage badge, shows exactly where a ticket sits in the pipeline (Hi-Fi, Pod Review, ...)
// rather than just the coarse Jira status (In Progress covers most of the pipeline, so on
// its own it doesn't say much).
var STAGE_META = {
  "TO DO":            { label:"To Do",           color:"var(--t3)"     },
  "RESEARCH":         { label:"Research",        color:"#8b5cf6"       },
  "LO-FI":            { label:"Lo-Fi",           color:"var(--amber)"  },
  "HI-FI":            { label:"Hi-Fi",           color:"var(--blue)"   },
  "UX IN PROGRESS":   { label:"UX In Progress",  color:"var(--accent)" },
  "CONTENT DESIGN":   { label:"Content Design",  color:"#14b8a6"       },
  "POD REVIEW":       { label:"Pod Review",      color:"var(--purple)" },
  "ITERATION":        { label:"Iteration",       color:"var(--amber)"  },
  "LT REVIEW":        { label:"LT Review",       color:"var(--red)"    },
  "Done":             { label:"Done",            color:"var(--green)"  },
};
function stageBadge(t) {
  var meta = STAGE_META[getStage(t)] || { label: t.status, color: "var(--t3)" };
  return '<span style="font-size:10px;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--surface-2);color:' + meta.color + '">' + meta.label + '</span>';
}

// Shared by both At Risk drill-downs (Overview + Exec Summary): "This Week" = the ticket's
// committed deadline fell within Mon→today, i.e. it became at-risk this week specifically,
// vs. an older miss still sitting unresolved.
function isAtRiskThisWeek(t) {
  var d = new Date(TODAY), dow = d.getDay();
  var monday = new Date(d); monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  var monStr = monday.toISOString().slice(0, 10);
  return (t.hiFiEnd && t.hiFiEnd >= monStr && t.hiFiEnd <= TODAY)
      || (t.loFiEnd && t.loFiEnd >= monStr && t.loFiEnd <= TODAY);
}

// ── Weekly relevance filter ───────────────────────────────────
// "This Week" = Monday through today (used on end-of-week pod review)
function isWeeklyRelevant(t) {
  // Always include currently active work
  if (t.status === "In Progress" || t.status === "In Review") return true;
  // Compute this Monday
  var d = new Date(TODAY);
  var dow = d.getDay(); // 0=Sun
  var monday = new Date(d);
  monday.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  var monStr = monday.toISOString().slice(0, 10);
  // Tickets due this week (lo-fi or hi-fi deadline fell Mon→today)
  if (t.loFiEnd && t.loFiEnd >= monStr && t.loFiEnd <= TODAY) return true;
  if (t.hiFiEnd && t.hiFiEnd >= monStr && t.hiFiEnd <= TODAY) return true;
  // Tickets completed this week
  if (t.status === "Done" && t.lastUpdated && t.lastUpdated >= monStr && t.lastUpdated <= TODAY) return true;
  return false;
}

function setHomeViewMode(m) { homeViewMode = m; renderHome(); }
function setHomeAtRiskViewMode(m) { homeAtRiskViewMode = m; renderHome(); }

function toggleHideUxSignoff() {
  hideUxSignoff = !hideUxSignoff;
  localStorage.setItem("designOps_hideUxSignoff", hideUxSignoff ? "1" : "0");
  renderWork();
}
function setWorkViewMode(m) {
  workViewMode = m;
  renderWork();
}

function buildDesignerView() {
  var qObj = QUARTERS.find(function(q){ return q.id === selectedQuarter; });
  var qEnd = qObj ? new Date(qObj.end) : null;
  var daysLeft = qEnd ? Math.max(0, Math.round((qEnd - new Date(TODAY)) / 86400000)) : null;
  var allDs = filteredDesigners();

  // 10 columns, matches the real Jira board. Every workflow's stages (Feature/UX Revamp/
  // Pattern, UX Signoff, UX Research, UX Signoff Review) fold into these via STAGE_MAP
  // in mapJiraIssue, so nothing needs its own column.
  var COLUMNS = [
    { key:"TO DO",           label:"To Do",            color:"var(--t3)"    },
    { key:"RESEARCH",        label:"Research",          color:"#8b5cf6"      },
    { key:"LO-FI",           label:"Lo-Fi",             color:"var(--amber)" },
    { key:"HI-FI",           label:"Hi-Fi",             color:"var(--blue)"  },
    { key:"UX IN PROGRESS",  label:"UX In Progress",    color:"var(--accent)"},
    { key:"CONTENT DESIGN",  label:"Content Design",    color:"#14b8a6"      },
    { key:"POD REVIEW",      label:"Pod Review",        color:"var(--purple)"},
    { key:"ITERATION",       label:"Iteration",         color:"var(--amber)" },
    { key:"LT REVIEW",       label:"LT Review",         color:"var(--red)"   },
    { key:"Done",            label:"Done",              color:"var(--green)" },
  ];

  function kanbanCard(t, showDesigner) {
    var d = designerById(t.assignee);
    var m = moduleById(t.module);
    var driftCount = (t.dateChanges || []).length;
    var stage = getStage(t);
    var stageCol = (COLUMNS.find(function(c){ return c.key === stage; }) || {}).color || "var(--border)";
    var isDone = t.status === "Done";
    var isTodo = stage === "TO DO";
    var isOverdue = t.hiFiEnd && t.hiFiEnd < TODAY && !isDone;
    var isDueToday = t.hiFiEnd === TODAY && !isDone;
    // Flags beyond a missed/due-today deadline (staleness, etc.), these still make the
    // designer-level "At Risk" pill true, so the card needs to show them too. Without this,
    // a ticket flagged only for "No Update 3w+" left the header saying At Risk while every
    // visible card looked perfectly normal, no way to tell which ticket was the reason.
    var otherFlags = ticketFlags(t).filter(function(f){ return f.label !== "Overdue" && f.label !== "Due Today" && f.label !== "Lo-Fi Due Today"; });
    // To Do cards: greyed out, no date emphasis needed (not yet started)
    if (isTodo) {
      var todoChanges = _postStartChanges(t);
      return '<div style="border:1px solid var(--border);border-left:3px solid var(--border);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;background:var(--surface-2);opacity:0.65">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<span class="ticket-key" style="font-size:11px;font-weight:700;font-family:monospace;color:var(--t3)">' + t.key + '</span>'
        + (todoChanges.length ? '<span title="' + (todoChanges[0].by + ' changed ' + todoChanges[0].field + ': ' + todoChanges[0].from + ' → ' + todoChanges[0].to + ' (' + todoChanges[0].date + ')').replace(/"/g,"&quot;") + '" style="font-size:9px;font-weight:700;color:var(--amber);cursor:help;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:2px"><span>🔄</span><span>' + todoChanges.length + '</span></span>' : '')
        + '</div>'
        + (showDesigner && d ? '<div style="width:22px;height:22px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';opacity:0.6;font-size:8px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center" title="' + d.name + '">' + initials(d.name) + '</div>' : '')
        + '</div>'
        + '<div style="font-size:12px;font-weight:600;color:var(--t3);line-height:1.4">' + t.summary + '</div>'
        + (m ? '<div style="font-size:10px;color:var(--t3);margin-top:6px;opacity:0.6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + m.icon + ' ' + m.name + '</div>' : '')
        + '</div>';
    }

    // Active stage cards: show date + status
    var accentLeft = isOverdue || isDueToday || otherFlags.length ? "var(--red)" : isDone ? "var(--green)" : stageCol;

    var badge = "";
    if (isDone) {
      badge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#d1fae5;color:var(--green)">✓ Done</span>';
    } else if (isOverdue) {
      badge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fde8e8;color:var(--red)">⚠ Missed</span>';
    } else if (isDueToday) {
      badge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fef3c7;color:var(--amber)">⏰ Due Today</span>';
    } else if (t.hiFiEnd && t.hiFiEnd > TODAY) {
      badge = '<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#dbeafe;color:var(--blue)">● On Track</span>';
    }

    // Format date: "12 Jun 2026"
    var dateDisplay = "";
    if (t.hiFiEnd) {
      var parts = t.hiFiEnd.split("-");
      var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      dateDisplay = parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
    }

    return '<div style="border:1px solid var(--border);border-left:3px solid ' + accentLeft + ';border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;background:var(--surface)">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">'
      + '<div style="display:flex;align-items:center;gap:6px;min-width:0">'
      +   '<span class="ticket-key" style="font-size:11px;font-weight:700;font-family:monospace;color:var(--accent)">' + t.key + '</span>'
      +   typePill(t.type)
      +   (function() {
            // Same rule as the ticket panel's History section: only count changes that
            // happened after work actually started (UX Start Date arrived), pre-commitment
            // date/scope churn while a ticket is still being queued isn't a useful signal.
            var visible = _postStartChanges(t);
            if (!visible.length) return "";
            var latest = visible[0];
            var tip = latest.by + ' changed ' + latest.field + ': ' + latest.from + ' → ' + latest.to + ' (' + latest.date + ')' + (visible.length > 1 ? ' · +' + (visible.length - 1) + ' more change' + (visible.length > 2 ? 's' : '') : '');
            return '<span title="' + tip.replace(/"/g,"&quot;") + '" style="font-size:9px;font-weight:700;color:var(--amber);cursor:help;white-space:nowrap;flex-shrink:0;display:inline-flex;align-items:center;gap:2px"><span>🔄</span><span>' + visible.length + '</span></span>';
          })()
      + '</div>'
      + (showDesigner && d ? '<div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center" title="' + d.name + '">' + initials(d.name) + '</div>' : '')
      + '</div>'
      + '<div style="font-size:12px;font-weight:700;color:var(--t1);line-height:1.45;margin-bottom:10px">' + t.summary + '</div>'
      + (m ? '<div style="font-size:10px;color:var(--t3);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + m.icon + ' ' + m.name + '</div>' : '')
      + (t.hiFiEnd
          ? '<div style="font-size:9px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px">Committed Hi-Fi Date</div>'
            + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">'
            + '<span style="font-size:13px;font-weight:700;color:' + (isOverdue||isDueToday?"var(--red)":"var(--t1)") + '">' + dateDisplay + '</span>'
            + badge
            + '</div>'
          : '')
      + (driftCount > 0 ? '<div style="font-size:10px;color:var(--t3);margin-top:6px">Date drifted ' + driftCount + ' time' + (driftCount > 1 ? 's' : '') + ' before</div>' : '')
      + (otherFlags.length ? '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">' + otherFlags.map(function(f){ return '<span title="' + (f.reason||"").replace(/"/g,"&quot;") + '" style="font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;background:' + (f.color==="var(--red)"?"#fde8e8":"#fef3c7") + ';color:' + f.color + '">' + f.label + '</span>'; }).join("") + '</div>' : '')
      + '</div>';
  }

  function buildKanban(tickets, showDesigner) {
    // Safety net, any ticket whose stage isn't in COLUMNS goes into "Other" so counts always match.
    var knownKeys = new Set(COLUMNS.map(function(c){ return c.key; }));
    var otherTs   = tickets.filter(function(t){ return !knownKeys.has(getStage(t)); });
    var displayColumns = otherTs.length > 0
      ? COLUMNS.concat([{ key:"__other__", label:"Other", color:"var(--t3)" }])
      : COLUMNS;
    var colCount = displayColumns.length;

    return '<div style="overflow-x:auto;padding:0 0 8px">'
      + '<div style="display:grid;grid-template-columns:repeat(' + colCount + ',minmax(180px,1fr));gap:12px;padding:16px 20px;min-width:' + (colCount * 200) + 'px">'
      + displayColumns.map(function(col) {
          var colTs = col.key === "__other__"
            ? otherTs
            : tickets.filter(function(t){ return getStage(t) === col.key; });
          colTs.sort(function(a,b){ return (a.hiFiEnd||"").localeCompare(b.hiFiEnd||""); });
          return '<div>'
            + '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;background:var(--surface-2);margin-bottom:10px;border-top:2px solid ' + col.color + '">'
            + '<span style="font-size:10px;font-weight:700;color:' + col.color + ';text-transform:uppercase;letter-spacing:.4px">' + col.label + '</span>'
            + (colTs.length > 0 ? '<span style="font-size:10px;font-weight:700;background:var(--bg);padding:2px 7px;border-radius:10px;color:var(--t3)">' + colTs.length + '</span>' : '')
            + '</div>'
            + (colTs.length === 0
                ? '<div style="font-size:11px;color:var(--t3);text-align:center;padding:20px 0;border:1px dashed var(--border);border-radius:6px;opacity:.5">, </div>'
                : colTs.map(function(t){ return kanbanCard(t, showDesigner); }).join(""))
            + '</div>';
        }).join("")
      + '</div></div>';
  }

  // ── View mode toggle (This Week first, default; All Quarter on demand) ─
  // No border-bottom here, selectorRow right below already supplies the single divider
  // before the ticket count bar, so this row doesn't need its own (stacking both reads as
  // a wall of redundant thin lines).
  var viewModeRow = '<div style="display:flex;align-items:center;gap:10px;padding:10px 20px 6px">'
    + '<div style="display:flex;border:1px solid var(--border);border-radius:var(--radius);overflow:hidden">'
    + '<button onclick="setWorkViewMode(\'week\')" style="padding:5px 16px;font-size:11px;font-weight:' + (workViewMode==="week"?"700":"400") + ';background:' + (workViewMode==="week"?"var(--accent)":"var(--surface)") + ';color:' + (workViewMode==="week"?"#fff":"var(--t2)") + ';border:none;cursor:pointer">This Week</button>'
    + '<button onclick="setWorkViewMode(\'quarter\')" style="padding:5px 16px;font-size:11px;font-weight:' + (workViewMode==="quarter"?"700":"400") + ';background:' + (workViewMode==="quarter"?"var(--accent)":"var(--surface)") + ';color:' + (workViewMode==="quarter"?"#fff":"var(--t2)") + ';border:none;cursor:pointer">All Quarter</button>'
    + '</div>'
    + '<div style="margin-left:auto;display:flex;align-items:center;gap:8px" title="UX Signoff tickets sit with the dev team, hide them from UX\'s own tracking view">'
    + '<span style="font-size:11px;font-weight:600;color:var(--t2)">Hide UX Signoffs</span>'
    + '<button onclick="toggleHideUxSignoff()" role="switch" aria-checked="' + hideUxSignoff + '" style="position:relative;width:36px;height:20px;border-radius:999px;border:none;cursor:pointer;padding:0;flex-shrink:0;background:' + (hideUxSignoff?"var(--accent)":"var(--border)") + ';transition:background .15s">'
    + '<span style="position:absolute;top:2px;left:' + (hideUxSignoff?"18px":"2px") + ';width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:left .15s"></span>'
    + '</button>'
    + '</div>'
    + '</div>';

  // ── Designer selector tabs ────────────────────────────────
  // Under "All Pods" the full list can be 15+ people, show it on demand instead of by
  // default. Once a specific pod is selected the roster is small enough to show as-is.
  var showDesignerTabs = (selectedPod !== "all") || workDesignerTabsExpanded;
  var selectorRow;
  if (!showDesignerTabs) {
    var atRiskCountAll = allDs.reduce(function(sum, d) {
      var dTs = TICKETS.filter(function(t){ return t.assignee===d.id && t.quarter===selectedQuarter && t.scope!=="OUT" && (!hideUxSignoff || t.type !== "UX Signoff"); }).map(auditTicket);
      return sum + dTs.filter(function(t){ return ticketFlags(t).length > 0; }).length;
    }, 0);
    selectorRow = '<div style="display:flex;align-items:center;gap:10px;padding:12px 20px;border-bottom:1px solid var(--border)">'
      + '<button onclick="setWorkDesignerFilter(\'all\')" style="padding:5px 14px;border-radius:20px;border:1px solid ' + (workDesignerFilter==="all"?"var(--t1)":"var(--border)") + ';background:' + (workDesignerFilter==="all"?"var(--t1)":"var(--surface)") + ';color:' + (workDesignerFilter==="all"?"#fff":"var(--t2)") + ';font-size:12px;font-weight:600;cursor:pointer">All Tickets</button>'
      + '<button onclick="workDesignerTabsExpanded=true;navigate(currentPage,false)" style="display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;border:1px dashed var(--border);background:transparent;color:var(--t2);font-size:12px;font-weight:600;cursor:pointer">Show designers (' + allDs.length + ')' + (atRiskCountAll > 0 ? '<span style="font-size:9px;font-weight:700;background:var(--red);color:#fff;padding:1px 5px;border-radius:8px">' + atRiskCountAll + '</span>' : '') + '</button>'
      + '</div>';
  } else {
    selectorRow = '<div style="display:flex;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid var(--border);flex-wrap:wrap">'
      + '<span style="font-size:11px;color:var(--t3);font-weight:500">Designer:</span>'
      + '<button onclick="setWorkDesignerFilter(\'all\')" style="padding:5px 14px;border-radius:20px;border:1px solid ' + (workDesignerFilter==="all"?"var(--t1)":"var(--border)") + ';background:' + (workDesignerFilter==="all"?"var(--t1)":"var(--surface)") + ';color:' + (workDesignerFilter==="all"?"#fff":"var(--t2)") + ';font-size:12px;font-weight:600;cursor:pointer">All Tickets</button>'
      + allDs.map(function(d) {
          var isActive = workDesignerFilter === d.id;
          var dTs = TICKETS.filter(function(t){ return t.assignee===d.id && t.quarter===selectedQuarter && t.scope!=="OUT" && (!hideUxSignoff || t.type !== "UX Signoff"); }).map(auditTicket);
          var atRisk = dTs.filter(function(t){ return ticketFlags(t).length > 0; }).length;
          return '<button onclick="setWorkDesignerFilter(\'' + d.id + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;border:1px solid ' + (isActive?dColor(d.id):"var(--border)") + ';background:' + (isActive?dColor(d.id):"var(--surface)") + ';color:' + (isActive?"#fff":"var(--t2)") + ';font-size:12px;font-weight:600;cursor:pointer">'
            + '<div style="width:18px;height:18px;border-radius:50%;background:' + (isActive?"rgba(255,255,255,0.3)":dColor(d.id)) + ';font-size:8px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
            + d.name.split(" ")[0]
            + (atRisk > 0 ? '<span style="font-size:9px;font-weight:700;background:' + (isActive?"rgba(255,255,255,0.25)":"var(--red)") + ';color:' + (isActive?"white":"white") + ';padding:1px 5px;border-radius:8px">' + atRisk + '</span>' : '')
            + '</button>';
        }).join("")
      + (selectedPod === "all" ? '<button onclick="workDesignerTabsExpanded=false;navigate(currentPage,false)" style="padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--t3);font-size:11px;cursor:pointer">Collapse ✕</button>' : '')
      + '</div>';
  }

  // ── Build kanban for selected designer or all ─────────────
  var kanbanHtml = "";
  if (workDesignerFilter === "all") {
    var allTs = allDs.reduce(function(acc, d) {
      return acc.concat(TICKETS.filter(function(t){ return t.assignee===d.id && t.quarter===selectedQuarter && t.scope!=="OUT" && (!hideUxSignoff || t.type !== "UX Signoff"); }).map(auditTicket));
    }, []);
    if (workViewMode === "week") allTs = allTs.filter(isWeeklyRelevant);
    var totalDone = allTs.filter(function(t){ return t.status==="Done"; }).length;
    var totalRisk = allTs.filter(function(t){ return ticketFlags(t).length > 0; }).length;
    var pct = allTs.length ? Math.round(totalDone / allTs.length * 100) : 0;
    var pctColor = pct >= 75 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)";

    kanbanHtml = '<div style="background:var(--surface)">'
      + viewModeRow
      + selectorRow
      + '<div style="padding:10px 20px 8px;display:flex;align-items:center;gap:16px;border-bottom:1px solid var(--border);background:var(--surface-2)">'
      + '<span style="font-size:12px;color:var(--t3)">'
      + '<strong style="color:var(--t1)">' + allTs.length + '</strong> tickets across ' + allDs.length + ' designers'
      + ' · <strong style="color:var(--green)">' + totalDone + '</strong> done'
      + (totalRisk > 0 ? ' · <strong style="color:var(--red)">' + totalRisk + '</strong> missed deadline' : '')
      + '</span>'
      + '<span style="margin-left:auto;font-size:13px;font-weight:700;color:' + pctColor + '">' + pct + '% delivered</span>'
      + '</div>'
      + buildKanban(allTs, true)
      + '</div>';
  } else {
    var d = designerById(workDesignerFilter);
    if (!d) return viewModeRow + selectorRow;
    var allDTs = TICKETS.filter(function(t){ return t.assignee===d.id && t.quarter===selectedQuarter && t.scope!=="OUT" && (!hideUxSignoff || t.type !== "UX Signoff"); }).map(auditTicket);
    var dTs = workViewMode === "week" ? allDTs.filter(isWeeklyRelevant) : allDTs;
    var doneCount = dTs.filter(function(t){ return t.status==="Done"; }).length;
    var atRiskTs  = dTs.filter(function(t){ return ticketFlags(t).length > 0; });
    var pct = dTs.length ? Math.round(doneCount / dTs.length * 100) : 0;
    var pctColor = pct >= 75 ? "var(--green)" : pct >= 40 ? "var(--accent)" : "var(--red)";
    var isAtRisk = atRiskTs.length > 0;
    var statusBg = isAtRisk ? "#fde8e8" : "#d1fae5";
    var statusColor = isAtRisk ? "var(--red)" : "var(--green)";
    var pm = POD_MANAGERS.find(function(p){ return p.pod === d.pod; });

    // Scenario breakdown panel, shows all delivery states for this designer
    var wDone     = dTs.filter(function(t){ return t.status==="Done"; });
    var wOverdue  = dTs.filter(function(t){ var f=ticketFlags(t); return f.some(function(x){ return x.label.indexOf("Overdue") !== -1; }); });
    var wDueToday = dTs.filter(function(t){ var f=ticketFlags(t); return f.some(function(x){ return x.label.indexOf("Due Today") !== -1; }); });
    var wOnTrack  = dTs.filter(function(t){ return (t.status==="In Progress"||t.status==="In Review") && ticketFlags(t).length===0; });
    var wDrifted  = dTs.filter(function(t){ return (t.dateChanges||[]).length>=2 && t.status!=="Done"; });
    var wTodo     = dTs.filter(function(t){ return t.status==="To Do"; });

    function scenarioChip(count, label, color, bg) {
      if (count === 0) return '';
      return '<div style="display:flex;flex-direction:column;align-items:center;padding:8px 14px;border-radius:var(--radius-sm);background:' + bg + ';min-width:64px">'
        + '<span style="font-size:18px;font-weight:700;color:' + color + ';line-height:1">' + count + '</span>'
        + '<span style="font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:' + color + ';margin-top:3px;text-align:center;white-space:nowrap">' + label + '</span>'
        + '</div>';
    }

    var weeklySummary = '<div style="padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface-2)">'
      + '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-bottom:8px">'
      + (workViewMode==="week" ? "This Week · Delivery Status" : "Quarter · Delivery Status")
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap">'
      + scenarioChip(wDone.length,     "Delivered",   "var(--green)",  "rgba(16,185,129,.10)")
      + scenarioChip(wOnTrack.length,  "On Track",    "var(--blue)",   "rgba(59,130,246,.10)")
      + scenarioChip(wDueToday.length, "Due Today",   "var(--amber)",  "rgba(245,158,11,.12)")
      + scenarioChip(wOverdue.length,  "Overdue",     "var(--red)",    "rgba(239,68,68,.10)")
      + scenarioChip(wDrifted.length,  "Date Drifted","var(--t3)",     "var(--surface-2)")
      + scenarioChip(wTodo.length,     "Not Started", "var(--t3)",     "var(--bg)")
      + '</div>'
      + (wOverdue.length > 0
          ? '<div style="margin-top:8px;padding:6px 10px;border-radius:var(--radius-sm);background:rgba(239,68,68,.07);border-left:3px solid var(--red)">'
            + '<span style="font-size:11px;color:var(--red);font-weight:600">⚠ Overdue: </span>'
            + '<span style="font-size:11px;color:var(--t2)">' + wOverdue.map(function(t){ return '<span class="ticket-key">' + t.key + '</span>, ' + t.summary.slice(0,40) + (t.summary.length>40?'…':''); }).join(' · ') + '</span>'
            + '</div>'
          : '')
      + (wDueToday.length > 0
          ? '<div style="margin-top:6px;padding:6px 10px;border-radius:var(--radius-sm);background:rgba(245,158,11,.07);border-left:3px solid var(--amber)">'
            + '<span style="font-size:11px;color:var(--amber);font-weight:600">⏰ Due today: </span>'
            + '<span style="font-size:11px;color:var(--t2)">' + wDueToday.map(function(t){ return '<span class="ticket-key">' + t.key + '</span>, ' + t.summary.slice(0,40) + (t.summary.length>40?'…':''); }).join(' · ') + '</span>'
            + '</div>'
          : '')
      + '</div>';

    var scopeLabel = workViewMode === "week" ? "this week" : "this quarter";
    kanbanHtml = '<div style="background:var(--surface)">'
      + viewModeRow
      + selectorRow
      + '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:16px">'
      + '<div style="width:40px;height:40px;border-radius:50%;background:' + dColor(d.id) + ';font-size:14px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
      + '<div style="flex:1">'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<span style="font-size:14px;font-weight:700;color:var(--t1)">' + d.name + '</span>'
      + (isAtRisk ? '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#fde8e8;color:var(--red)">⚠ At Risk</span>' : '')
      + '</div>'
      + '<div style="font-size:11px;color:var(--t3);margin-top:2px">' + (pm ? pm.name + ' · ' : '') + (d.pod==="pod-a"?"Pod A":"Pod B") + ' · ' + dTs.length + ' tickets ' + scopeLabel + '</div>'
      + '</div>'
      + '</div>'
      + weeklySummary
      + buildKanban(dTs, false)
      + '</div>';
  }

  return kanbanHtml;
}

function toggleWorkDesigner(id) {
  expandedDesigner = expandedDesigner === id ? null : id;
  renderWork();
  if (expandedDesigner) {
    setTimeout(function(){
      var el = document.querySelector('[onclick*="toggleWorkDesigner(\'' + expandedDesigner + '\')"]');
      if (el) el.scrollIntoView({behavior:"smooth", block:"start"});
    }, 50);
  }
}

// ── PLANNING ─────────────────────────────────────────────────
var planningTab = "current";
var planningNoPRD = false;

function setPlanningTab(t) { planningTab = t; planningNoPRD = false; renderPlanning(); }
function togglePlanningNoPRD() { planningNoPRD = !planningNoPRD; renderPlanning(); }
function togglePlanningRow(id) {
  expandedPlanningRow = expandedPlanningRow === id ? null : id;
  renderPlanning();
}

function renderPlanning() {
  var activeQ = QUARTERS.find(function(q){ return q.status === "active"; });
  var nextQ   = QUARTERS.find(function(q){ return q.status === "planning"; });
  var q3ts    = TICKETS.filter(function(t){ return t.quarter === ACTIVE_QUARTER; }).map(auditTicket);
  var q3open  = q3ts.filter(function(t){ return t.status !== "Done"; });
  var q4      = PLANNING_TICKETS.filter(function(p){ return p.cutline !== "OUT"; });
  var in4     = q4.filter(function(p){ return p.cutline === "IN"; });
  var tbd4    = q4.filter(function(p){ return p.cutline === "TBD"; });
  var noPRD4  = q4.filter(function(p){ return !p.prdReady; });

  function planBadge(c) {
    var cls = {IN:"b-cut-in", OUT:"b-cut-out", TBD:"b-cut-tbd"}[c] || "b-out";
    return '<span class="badge ' + cls + '">' + c + '</span>';
  }

  // ── Tab row ──────────────────────────────────────────────────
  var tabs = '<div class="sds-tab-row">'
    + '<button class="sds-tab ' + (planningTab==="current"?"active":"") + '" onclick="setPlanningTab(\'current\')">'
    + (activeQ ? activeQ.sprintName + ' · Current' : 'Current') + '</button>'
    + '<button class="sds-tab ' + (planningTab==="q4"?"active":"") + '" onclick="setPlanningTab(\'q4\')">'
    + (nextQ ? nextQ.sprintName + ' · Q4 Pipeline' : 'Q4 Pipeline')
    + (noPRD4.length > 0 ? ' <span style="background:var(--red);color:#fff;border-radius:999px;padding:1px 7px;font-size:10px;font-weight:700">' + noPRD4.length + ' no PRD</span>' : '')
    + '</button>'
    + '</div>';

  // ══════════════════════════════════════════════════════════════
  // CURRENT TAB, workload distribution + Q3 in-flight
  // ══════════════════════════════════════════════════════════════
  var currentPanel = '';
  if (planningTab === "current") {

    // ── Workload distribution table ───────────────────────────
    // Compute bandwidth: designers who have cleared ALL sprint tickets
    var bandwidthDesigners = DESIGNERS.filter(function(d) {
      var dTs = q3ts.filter(function(t){ return t.assignee === d.id; });
      return dTs.length > 0 && dTs.every(function(t){ return t.status === "Done"; });
    });

    var wRows = DESIGNERS.map(function(d) {
      var dTs    = q3ts.filter(function(t){ return t.assignee === d.id; });
      var active = dTs.filter(function(t){ return t.status === "In Progress"; }).length;
      var review = dTs.filter(function(t){ return t.status === "In Review"; }).length;
      var todo   = dTs.filter(function(t){ return t.status === "To Do"; }).length;
      var done   = dTs.filter(function(t){ return t.status === "Done"; }).length;
      var flaggedTs = dTs.filter(function(t){ return t.riskFlags && t.riskFlags.length > 0; });
      var flagged = flaggedTs.length;
      var cap    = computeCapacity(d.id, ACTIVE_QUARTER);
      var isExpanded = expandedPlanningRow === d.id;

      var loadClr = cap.status === "overloaded" ? "var(--red)" : cap.status === "at_risk" ? "var(--amber)" : "var(--green)";
      var loadLbl = cap.status === "overloaded" ? "Overloaded" : cap.status === "at_risk" ? "Heavy" : "Balanced";

      var flagCell = flagged > 0
        ? '<span onclick="togglePlanningRow(\'' + d.id + '\')" style="color:var(--red);font-weight:700;font-size:12px;cursor:pointer;text-decoration:underline dotted">⚠ ' + flagged + '</span>'
        : '<span style="color:var(--green);font-size:12px">✓</span>';

      var expandedRow = '';
      if (isExpanded && flagged > 0) {
        var flagDetails = flaggedTs.map(function(t) {
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
            + '<span class="ticket-key">' + t.key + '</span>'
            + '<span style="flex:1;font-size:12px">' + t.summary + '</span>'
            + t.riskFlags.map(riskBadge).join("") + statusBadge(t.status)
            + '</div>';
        }).join("");
        expandedRow = '<tr><td colspan="7" style="padding:10px 16px;background:var(--red-bg)">'
          + '<div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Flagged tickets</div>'
          + flagDetails + '</td></tr>';
      }

      return '<tr style="cursor:default">'
        + '<td><div style="display:flex;align-items:center;gap:8px">'
        + '<div style="width:28px;height:28px;border-radius:50%;background:' + dColor(d.id) + ';font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
        + '<div style="font-weight:700;font-size:12px">' + d.name + '</div>'
        + '</div></td>'
        + '<td style="text-align:center;font-size:14px;font-weight:700;color:var(--blue)">' + active + '</td>'
        + '<td style="text-align:center;font-size:14px;font-weight:700;color:var(--purple)">' + review + '</td>'
        + '<td style="text-align:center;font-size:14px;font-weight:700;color:var(--t3)">' + todo + '</td>'
        + '<td style="text-align:center;font-size:14px;font-weight:700;color:var(--green)">' + done + '</td>'
        + '<td style="text-align:center">' + flagCell + '</td>'
        + '<td><span style="font-size:12px;font-weight:700;color:' + loadClr + '">' + loadLbl + '</span></td>'
        + '</tr>'
        + expandedRow;
    }).join("");

    // Bandwidth banner, only shown when someone has cleared all tickets
    var bandwidthBanner = '';
    if (bandwidthDesigners.length > 0) {
      var sprintDLeft = Math.max(0, daysBetween(TODAY, (QUARTERS.find(function(q){ return q.id===ACTIVE_QUARTER; })||{}).end || TODAY));
      bandwidthBanner = '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:var(--green-bg);border-left:3px solid var(--green);border-radius:var(--radius-sm);margin-bottom:var(--gap)">'
        + '<span style="font-size:14px">✅</span>'
        + '<div style="font-size:12px;font-weight:600;color:var(--green)">'
        + bandwidthDesigners.map(function(d){ return d.name.split(" ")[0]; }).join(", ")
        + ' ' + (bandwidthDesigners.length === 1 ? 'has' : 'have') + ' cleared all sprint tickets'
        + (sprintDLeft > 0 ? ', ' + sprintDLeft + 'd remaining in sprint. Available for new scope.' : '.')
        + '</div></div>';
    }

    var workloadCard = '<div class="card" style="margin-bottom:var(--gap)">'
      + '<div style="padding:14px 20px;border-bottom:1px solid var(--border)">'
      + '<div style="font-size:14px;font-weight:700">Workload Distribution</div>'
      + '</div>'
      + '<div class="table-wrap"><table>'
      + '<thead><tr><th>Designer</th><th style="text-align:center">Active</th><th style="text-align:center">Review</th><th style="text-align:center">Todo</th><th style="text-align:center">Done</th><th style="text-align:center">Flags</th><th>Load</th></tr></thead>'
      + '<tbody>' + wRows + '</tbody></table></div>'
      + '</div>';

    currentPanel = bandwidthBanner + workloadCard;
  }

  // ══════════════════════════════════════════════════════════════
  // Q4 TAB, next quarter pipeline with readiness flags
  // ══════════════════════════════════════════════════════════════
  var q4Panel = '';
  if (planningTab === "q4") {
    var shown = planningNoPRD ? q4.filter(function(p){ return !p.prdReady; }) : q4;

    // Stat strip
    var q4Stats = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap);margin-bottom:var(--gap)">'
      + '<div class="card" style="padding:16px 18px;text-align:center"><div style="font-size:26px;font-weight:700;color:var(--t1)">' + q4.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Queued</div></div>'
      + '<div class="card" style="padding:16px 18px;text-align:center"><div style="font-size:26px;font-weight:700;color:var(--green)">' + in4.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Confirmed IN</div></div>'
      + '<div class="card" style="padding:16px 18px;text-align:center"><div style="font-size:26px;font-weight:700;color:var(--amber)">' + tbd4.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">Evaluating</div></div>'
      + '<div class="card" style="padding:16px 18px;text-align:center;cursor:pointer" onclick="togglePlanningNoPRD()" title="Click to filter">'
      + '<div style="font-size:26px;font-weight:700;color:' + (noPRD4.length > 0 ? 'var(--red)' : 'var(--green)') + '">' + noPRD4.length + '</div>'
      + '<div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.05em;margin-top:2px">No PRD</div>'
      + (planningNoPRD ? '<div style="font-size:10px;color:var(--accent);margin-top:3px;font-weight:700">Filtering ✕</div>' : '<div style="font-size:10px;color:var(--t3);margin-top:3px">Click to filter</div>')
      + '</div></div>';

    // Designers who cleared all current sprint tickets, available for Q4 planning
    var q4BandwidthDs = DESIGNERS.filter(function(d) {
      var dTs = q3ts.filter(function(t){ return t.assignee === d.id; });
      return dTs.length > 0 && dTs.every(function(t){ return t.status === "Done"; });
    });

    var q4Items = shown.map(function(p) {
      var da  = DESIGNERS.find(function(d){ return d.id === p.tentativeAssignee; });
      var mod = moduleById(p.module) || { name: p.module, icon: "" };
      var assigneeCap = da ? computeCapacity(da.id, ACTIVE_QUARTER) : null;
      var assigneeOverloaded = assigneeCap && assigneeCap.status === "overloaded";

      // Readiness flags
      var flags = [];
      if (!p.prdReady)           flags.push('<span class="badge" style="background:var(--red-bg);color:var(--red);border-color:var(--red)">No PRD</span>');
      if (!p.tentativeAssignee)  flags.push('<span class="badge" style="background:var(--amber-bg);color:var(--amber);border-color:var(--amber)">Unassigned</span>');

      // Bandwidth suggestion: if unassigned or assignee is overloaded, suggest someone who's free
      var suggestion = '';
      if (q4BandwidthDs.length > 0 && (!p.tentativeAssignee || assigneeOverloaded)) {
        var samePodFree = q4BandwidthDs.filter(function(d){ return d.pod === p.pod; });
        var suggestD = samePodFree.length > 0 ? samePodFree[0] : q4BandwidthDs[0];
        suggestion = '<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 8px;background:var(--green-bg);border-radius:4px;margin-top:6px">'
          + '<span style="font-size:10px;font-weight:700;color:var(--green)">Suggest →</span>'
          + '<div style="width:18px;height:18px;border-radius:50%;background:' + dColor(suggestD.id) + ';font-size:9px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center">' + initials(suggestD.name) + '</div>'
          + '<span style="font-size:11px;font-weight:600;color:var(--green)">' + suggestD.name.split(" ")[0] + ', cleared sprint' + (assigneeOverloaded ? ', current assignee overloaded' : '') + '</span>'
          + '</div>';
      }

      var rowBg = !p.prdReady ? 'background:var(--red-bg)' : '';

      return '<div style="display:flex;align-items:flex-start;gap:14px;padding:12px 20px;border-bottom:1px solid var(--border);' + rowBg + '">'
        + '<div style="width:30px;height:30px;border-radius:50%;flex-shrink:0;background:' + (da ? dColor(da.id) : "var(--border)") + ';font-size:10px;font-weight:700;color:' + (da ? '#fff' : 'var(--t3)') + ';display:flex;align-items:center;justify-content:center;margin-top:2px">'
        + (da ? initials(da.name) : "?") + '</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px">'
        + '<span class="pi-key">' + p.key + '</span>'
        + '<span style="font-size:12px;font-weight:700">' + p.summary + '</span>'
        + planBadge(p.cutline)
        + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-bottom:6px">'
        + mod.icon + ' ' + mod.name + ' · ' + (da ? da.name : '<span style="color:var(--amber);font-weight:500">Unassigned</span>')
        + '</div>'
        + '<div class="pi-chips" style="flex-wrap:wrap">'
        + typeBadge(p.type) + sizeBadge(p.size)
        + flags.join("")
        + '</div>'
        + (p.comments ? '<div style="font-size:12px;color:var(--t2);margin-top:6px;line-height:1.4">' + p.comments + '</div>' : '')
        + suggestion
        + '</div></div>';
    }).join("");

    var q4Block = '<div class="card">'
      + '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
      + '<span style="font-size:14px;font-weight:700">Q4 Pipeline</span>'
      + '<span class="badge b-prog">' + shown.length + (planningNoPRD ? ' without PRD' : ' tickets') + '</span>'
      + (planningNoPRD ? '<button class="btn btn-secondary" style="margin-left:auto" onclick="togglePlanningNoPRD()">Show all</button>' : '')
      + '</div>'
      + (shown.length === 0 ? '<div class="empty">No tickets match filter</div>' : q4Items)
      + '</div>';

    q4Panel = q4Stats + q4Block;
  }

  document.getElementById("planning-content").innerHTML = tabs + (planningTab === "current" ? currentPanel : q4Panel);
}

// ── RISKS ────────────────────────────────────────────────────
function renderRisks() {
  var all    = allRiskyTickets();
  var redN   = all.filter(function(t){ return riskSev(t.riskFlags)==="red"; }).length;
  var amberN = all.filter(function(t){ return riskSev(t.riskFlags)==="amber"; }).length;
  var tickets = riskFilter !== "all" ? all.filter(function(t){ return riskSev(t.riskFlags)===riskFilter; }) : all;

  document.getElementById("risk-filter-row").innerHTML =
    '<button class="pill ' + (riskFilter==="all"?"active":"") + '" onclick="setRiskFilter(\'all\')">All ' + all.length + '</button>'
    + '<button class="pill ' + (riskFilter==="red"?"active":"") + '" style="' + (riskFilter!=="red"?"color:var(--red)":"") + '" onclick="setRiskFilter(\'red\')">🚨 Critical ' + redN + '</button>'
    + '<button class="pill ' + (riskFilter==="amber"?"active":"") + '" style="' + (riskFilter!=="amber"?"color:var(--amber)":"") + '" onclick="setRiskFilter(\'amber\')">⚠️ Warning ' + amberN + '</button>';

  document.getElementById("risk-list").innerHTML = tickets.length === 0
    ? '<div class="empty">No tickets match the filter 🎉</div>'
    : tickets.map(function(t) {
        var sev = riskSev(t.riskFlags);
        var d   = designerById(t.assignee);
        var age = daysBetween(t.lastUpdated, TODAY);
        var m   = moduleById(t.module);
        return '<div class="risk-row sev-' + sev + '" id="rr-' + t.key + '" onclick="toggleRisk(\'' + t.key + '\')">'
          + '<div class="rr-icon">' + riskIcon(t.riskFlags) + '</div>'
          + '<div class="rr-body">'
          + '<div class="rr-top"><span class="rr-key">' + t.key + '</span><span class="rr-title">' + t.summary + '</span></div>'
          + '<div class="rr-meta">'
          + (d ? '<span style="display:inline-flex;align-items:center;gap:5px"><span style="width:16px;height:16px;border-radius:50%;background:' + dColor(d.id) + ';font-size:10px;font-weight:700;color:white;display:inline-flex;align-items:center;justify-content:center">' + initials(d.name) + '</span>' + d.name + '</span>' : (t.assignee || 'Unassigned'))
          + (m ? ' · ' + m.name : '') + ' · ' + (t.lastUpdated || ', ')
          + '</div>'
          + '<div class="rr-flags">' + t.riskFlags.map(riskBadge).join("") + '</div>'
          + '</div>'
          + '<div class="rr-right"><div class="rr-days" style="color:var(--' + (sev==="red"?"red":"amber") + ')">' + age + 'd ago</div>'
          + (t.comments ? '<div class="rr-comment">' + t.comments + '</div>' : "")
          + '</div></div>'
          + '<div class="risk-detail" id="rd-' + t.key + '">'
          + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Type</div><div style="margin-top:3px">' + typeBadge(t.type) + '</div></div>'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Size</div><div style="margin-top:3px">' + sizeBadge(t.size) + '</div></div>'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Status</div><div style="margin-top:3px">' + statusBadge(t.status) + '</div></div>'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Lo-Fi End</div><div style="font-size:12px;margin-top:3px">' + t.loFiEnd + '</div></div>'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Hi-Fi End</div><div style="font-size:12px;margin-top:3px">' + t.hiFiEnd + '</div></div>'
          + '<div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Scope</div><div style="font-size:12px;margin-top:3px">' + (t.scope||", ") + '</div></div>'
          + '</div>'
          + (t.dateChanges&&t.dateChanges.length ? '<div style="font-size:12px;color:var(--amber)">📅 Date changed ' + t.dateChanges.length + '×, ' + t.dateChanges.join(" → ") + '</div>' : "")
          + '</div>';
      }).join("");
}

function toggleRisk(key) {
  var prev = expandedRisk;
  if (prev) { var pe = document.getElementById("rd-"+prev); if(pe) pe.classList.remove("open"); }
  expandedRisk = prev === key ? null : key;
  if (expandedRisk) { var ne = document.getElementById("rd-"+expandedRisk); if(ne) ne.classList.add("open"); }
}
function setRiskFilter(f) { riskFilter = f; renderRisks(); }

function toggleVpAtRisk() {
  vpAtRiskExpanded = !vpAtRiskExpanded;
  if (vpAtRiskExpanded) vpDeviationsExpanded = false;  // only one drill-down panel open at a time
  renderVPSync();
}
function toggleVpDesigner(id) {
  _vpExpandedDesigner = (_vpExpandedDesigner === id) ? null : id;
  renderVPSync();
}
function toggleVpDeviations() {
  vpDeviationsExpanded = !vpDeviationsExpanded;
  if (vpDeviationsExpanded) vpAtRiskExpanded = false;  // only one drill-down panel open at a time
  renderVPSync();
}
function setVpAtRiskViewMode(m) {
  vpAtRiskViewMode = m;
  renderVPSync();
}

function toggleVpMidSprint() {
  var panel = document.getElementById("vp-mid-panel");
  var arrow = document.getElementById("vp-mid-toggle-arrow");
  if (!panel) return;
  var open = panel.style.display !== "none";
  panel.style.display = open ? "none" : "block";
  if (arrow) arrow.textContent = open ? "↓" : "↑";
}

// ── VP SYNC ──────────────────────────────────────────────────
function renderVPSync() {
  var qObj = QUARTERS.find(function(q){ return q.id === selectedQuarter; });
  var stats = quarterStats();
  var qEnd  = qObj ? new Date(qObj.end) : null;
  var daysLeft = qEnd ? Math.max(0, Math.round((qEnd - new Date(TODAY)) / 86400000)) : null;
  var pace = sprintPace(qObj);
  // Respect the team roster + pod filter so Exec Summary matches Overview
  var allTs = filteredTickets(selectedQuarter).filter(function(t){ return t.scope !== "OUT"; }).map(auditTicket);
  var atRiskTs = allTs.filter(function(t){ return ticketFlags(t).length > 0; });
  var midSprintTs = TICKETS.filter(function(t){ return t.quarter === selectedQuarter && t.addedMidSprint; });
  var committed = qObj ? (qObj.committed || stats.total) : stats.total;
  var q4In = PLANNING_TICKETS.filter(function(p){ return p.cutline==="IN"; }).length;
  var pctColor = paceColor(stats.pct, pace.expected, pace.tooEarly);
  var paceMsg  = paceLabel(stats.pct, pace.expected, pace.tooEarly);

  // ── Top metrics (4 cards, redesigned for leadership readout) ───────────────
  // Card 1: DELIVERY, "97/108" (done / committed at sprint start)
  var deliveryCol = pace.tooEarly ? "var(--t1)" : pctColor;
  var deliveryCard = '<div class="card" style="padding:18px 20px;text-align:center">'
    + '<div style="font-size:28px;font-weight:700;color:' + deliveryCol + '">'
    +   '<span style="color:var(--green)">' + stats.done + '</span>'
    +   '<span style="color:var(--t3);font-weight:500">/</span>'
    +   '<span style="color:var(--t1)">' + committed + '</span>'
    + '</div>'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-top:4px">Delivered</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-top:2px">' + stats.pct + '% of ' + committed + ' committed at sprint start</div>'
    + '</div>';

  // Card 2: AT RISK, committed-deadline misses + (if this-week view) planned-not-delivered
  var weekMissed = [];
  if (typeof WEEKLY !== "undefined" && Array.isArray(WEEKLY.missed) && WEEKLY.missed.length) {
    var missedSet = new Set(WEEKLY.missed);
    weekMissed = allTs.filter(function(t){ return missedSet.has(t.key); });
  }
  var atRiskAll = [].concat(atRiskTs);
  weekMissed.forEach(function(t){ if (atRiskAll.indexOf(t) === -1) atRiskAll.push(t); });
  var riskCard = '<div class="card" style="padding:18px 20px;text-align:center' + (atRiskAll.length > 0 ? ';cursor:pointer' : '') + '" onclick="' + (atRiskAll.length > 0 ? 'toggleVpAtRisk()' : '') + '">'
    + '<div style="font-size:28px;font-weight:700;color:' + (atRiskAll.length > 0 ? 'var(--red)' : 'var(--green)') + '">' + atRiskAll.length
    +   (atRiskAll.length > 0 ? '<span style="font-size:14px;color:var(--t3);margin-left:4px">' + (vpAtRiskExpanded ? '↑' : '↓') + '</span>' : '')
    + '</div>'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-top:4px">At Risk</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-top:2px">'
    +   (atRiskAll.length === 0 ? "No misses" :
        atRiskTs.length + " deadline" + (atRiskTs.length===1?"":"s") + " missed" + (weekMissed.length ? " · " + weekMissed.length + " missed this week" : ""))
    + '</div>'
    + '</div>';

  // Card 3: TEAM UTILISATION, ticket-days assigned / (team working days minus days-out)
  var teamSize   = filteredDesigners().length || 1;
  var ticketDays = allTs.reduce(function(s,t){ return s + (SIZES[t.size] || SIZES.M || 3); }, 0);
  var teamDaysOut = filteredDesigners().reduce(function(s,d){ return s + daysOutFor(d.id, selectedQuarter); }, 0);
  var capacityDays = teamSize * (pace.totalWD || 65) - teamDaysOut;
  var utilization  = capacityDays > 0 ? Math.round(ticketDays / capacityDays * 100) : 0;
  var utilCol = utilization > 100 ? "var(--red)" : utilization >= 80 ? "var(--amber)" : utilization >= 50 ? "var(--green)" : "var(--t2)";
  var utilLabel = utilization > 100 ? "Overloaded" : utilization >= 80 ? "High load" : utilization >= 50 ? "Healthy" : "Underloaded";
  var utilCard = '<div class="card" style="padding:18px 20px;text-align:center" title="Ticket-days assigned (by T-shirt size) as % of team working-day capacity">'
    + '<div style="font-size:28px;font-weight:700;color:' + utilCol + '">' + utilization + '%</div>'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-top:4px">Team Utilisation</div>'
    + '<div style="font-size:11px;color:' + utilCol + ';font-weight:600;margin-top:2px">' + utilLabel + ' · ' + teamSize + 'd × ' + (pace.totalWD || 0) + ' WD</div>'
    + '</div>';

  // Card 4: SCOPE DEVIATIONS, mid-sprint additions + date/scope/size churn AFTER a
  // ticket actually started (same "only after commitment" rule as the panel's History, // most tickets churn on dates/scope while still queued, before real work begins).
  var startedTs      = allTs.filter(_hasStarted);
  var driftTs        = startedTs.filter(function(t){ return _postStartChanges(t).filter(function(c){ return c.kind === "date"; }).length >= 2 && t.status !== "Done"; });
  var scopeChangeTs  = startedTs.filter(function(t){ return _postStartChanges(t).some(function(c){ return c.kind === "scope"; }); });
  var sizeChangeTs   = startedTs.filter(function(t){ return _postStartChanges(t).some(function(c){ return c.kind === "size"; }); });
  var deviationsCount = midSprintTs.length + driftTs.length + scopeChangeTs.length + sizeChangeTs.length;
  var devCol = deviationsCount === 0 ? "var(--green)" : deviationsCount <= 3 ? "var(--amber)" : "var(--red)";
  var deviationsCard = '<div class="card" style="padding:18px 20px;text-align:center' + (deviationsCount > 0 ? ';cursor:pointer' : '') + '" ' + (deviationsCount > 0 ? 'onclick="toggleVpDeviations()"' : '') + '>'
    + '<div style="font-size:28px;font-weight:700;color:' + devCol + '">' + deviationsCount + (deviationsCount > 0 ? '<span style="font-size:14px;color:var(--t3);margin-left:4px">' + (vpDeviationsExpanded ? '↑' : '↓') + '</span>' : '') + '</div>'
    + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3);margin-top:4px">Scope Deviations</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-top:2px">'
    +   (deviationsCount === 0 ? "✓ No changes since work started" :
        [
          midSprintTs.length ? midSprintTs.length + " added" : "",
          driftTs.length     ? driftTs.length + " date-drifted" : "",
          scopeChangeTs.length ? scopeChangeTs.length + " scope-changed" : "",
          sizeChangeTs.length? sizeChangeTs.length + " re-sized" : ""
        ].filter(Boolean).join(" · "))
    + '</div>'
    + '</div>';

  var metricsRow = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap);margin-bottom:var(--gap)">'
    + deliveryCard + riskCard + utilCard + deviationsCard
    + '</div>';

  // Scope Deviations expanded panel
  var deviationsPanel = "";
  if (vpDeviationsExpanded && deviationsCount > 0) {
    function devRow(t, tag, tagColor) {
      var d = designerById(t.assignee);
      return '<tr>'
        + '<td class="ticket-key">' + t.key + '</td>'
        + '<td style="white-space:normal;line-height:1.4">' + t.summary + '</td>'
        + '<td>' + (d ? d.name.split(" ")[0] : ", ") + '</td>'
        + '<td><span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:' + tagColor + '22;color:' + tagColor + '">' + tag + '</span></td>'
        + '<td>' + (t.hiFiEnd || ", ") + (((t.dateChanges||[]).length) ? ' <span style="color:var(--red);font-weight:700">(moved ' + t.dateChanges.length + '×)</span>' : '') + '</td>'
        + '</tr>';
    }
    var rowsHtml = ""
      + midSprintTs.map(function(t){ return devRow(t, "Added mid-sprint", "var(--amber)"); }).join("")
      + driftTs.map(function(t){ return devRow(t, "Date drifted",     "var(--red)");   }).join("")
      + scopeChangeTs.map(function(t){ return devRow(t, "Scope changed",  "var(--purple)"); }).join("")
      + sizeChangeTs.map(function(t){ return devRow(t, "Size changed",   "var(--accent)");}).join("");
    deviationsPanel = '<div style="margin-bottom:var(--gap);border:1px solid ' + devCol + ';border-radius:var(--radius);overflow:hidden">'
      + '<div style="padding:10px 16px;background:' + devCol + '15;border-bottom:1px solid ' + devCol + ';display:flex;align-items:center;justify-content:space-between">'
      +   '<span style="font-size:12px;font-weight:700;color:' + devCol + '">Scope Deviations, ' + deviationsCount + ' ticket' + (deviationsCount>1?"s":"") + '</span>'
      +   '<button onclick="toggleVpDeviations()" style="border:none;background:none;color:' + devCol + ';cursor:pointer;font-size:14px">✕</button>'
      + '</div>'
      + '<div class="table-wrap"><table style="table-layout:fixed;width:100%">'
      +   '<colgroup><col style="width:90px"><col><col style="width:100px"><col style="width:150px"><col style="width:140px"></colgroup>'
      +   '<thead><tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>Deviation</th><th>Hi-Fi Date</th></tr></thead>'
      +   '<tbody>' + rowsHtml + '</tbody></table></div>'
      + '</div>';
  }

  // Mid-sprint drill-down (toggled)
  var midSprintPanel = "";
  if (midSprintTs.length > 0) {
    midSprintPanel = '<div id="vp-mid-panel" style="display:none;margin-bottom:var(--gap);border:1px solid var(--amber);border-radius:var(--radius);overflow:hidden">'
      + '<div style="padding:10px 16px;background:var(--amber-bg);border-bottom:1px solid var(--amber);display:flex;align-items:center;justify-content:space-between">'
      + '<span style="font-size:12px;font-weight:700;color:var(--amber)">Tickets added after sprint started</span>'
      + '<button onclick="toggleVpMidSprint()" style="border:none;background:none;color:var(--amber);cursor:pointer;font-size:14px">✕</button>'
      + '</div>'
      + '<div style="padding:0 16px">'
      + midSprintTs.map(function(t) {
          var d = designerById(t.assignee);
          var m = moduleById(t.module);
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bg)">'
            + (d ? '<div style="width:24px;height:24px;border-radius:50%;flex-shrink:0;background:' + dColor(d.id) + ';font-size:9px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>' : '')
            + '<span class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace">' + t.key + '</span>'
            + '<span style="font-size:12px;font-weight:600;flex:1">' + t.summary + '</span>'
            + (d ? '<span style="font-size:11px;color:var(--t3)">' + d.name.split(" ")[0] + '</span>' : '')
            + (m ? '<span style="font-size:11px;color:var(--t3)">' + m.icon + ' ' + m.name + '</span>' : '')
            + statusBadge(t.status)
            + '</div>';
        }).join("")
      + '</div></div>';
  }

  // ── At Risk expanded panel (shown when AT RISK card is clicked) ─
  var atRiskPanel = "";
  if (vpAtRiskExpanded && atRiskTs.length > 0) {
    var atRiskRows = vpAtRiskViewMode === "week" ? atRiskTs.filter(isAtRiskThisWeek) : atRiskTs;

    atRiskPanel = '<div style="margin-bottom:var(--gap);border:1px solid var(--red);border-radius:var(--radius);overflow:hidden">'
      + '<div style="padding:10px 16px;background:#fde8e8;border-bottom:1px solid var(--red);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">'
      + '<div><span style="font-size:12px;font-weight:700;color:var(--red)">At Risk Tickets</span>'
      + '<span style="font-size:11px;color:var(--red);margin-left:8px">,  Committed Hi-Fi deadline passed without completion</span></div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<div style="display:flex;border:1px solid var(--red);border-radius:var(--radius);overflow:hidden">'
      + '<button onclick="setVpAtRiskViewMode(\'week\')" style="padding:4px 12px;font-size:11px;font-weight:' + (vpAtRiskViewMode==="week"?"700":"400") + ';background:' + (vpAtRiskViewMode==="week"?"var(--red)":"transparent") + ';color:' + (vpAtRiskViewMode==="week"?"#fff":"var(--red)") + ';border:none;cursor:pointer">This Week</button>'
      + '<button onclick="setVpAtRiskViewMode(\'quarter\')" style="padding:4px 12px;font-size:11px;font-weight:' + (vpAtRiskViewMode==="quarter"?"700":"400") + ';background:' + (vpAtRiskViewMode==="quarter"?"var(--red)":"transparent") + ';color:' + (vpAtRiskViewMode==="quarter"?"#fff":"var(--red)") + ';border:none;cursor:pointer">Quarter</button>'
      + '</div>'
      + '<button onclick="toggleVpAtRisk()" style="border:none;background:none;color:var(--red);cursor:pointer;font-size:14px">✕</button>'
      + '</div>'
      + '</div>'
      + (atRiskRows.length === 0
          ? '<div class="empty">No deadlines missed this week</div>'
          : '<div class="table-wrap"><table style="table-layout:fixed;width:100%">'
          + '<colgroup><col style="width:90px"><col><col style="width:90px"><col style="width:140px"><col style="width:90px"></colgroup>'
          + '<thead><tr><th>Ticket</th><th>Summary</th><th>Assignee</th><th>Risk</th><th>Status</th></tr></thead>'
          + '<tbody>' + atRiskRows.map(function(t) {
              var dA = designerById(t.assignee);
              var tfl = ticketFlags(t);
              return '<tr>'
                + '<td class="ticket-key">' + t.key + '</td>'
                + '<td style="white-space:normal;line-height:1.4">' + t.summary + '</td>'
                + '<td>' + (dA ? dA.name.split(" ")[0] : t.assignee) + '</td>'
                + '<td><div style="display:flex;gap:4px;flex-wrap:wrap">' + tfl.map(function(f){ return '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:' + (f.color==="var(--red)"?"#fde8e8":"#fef3c7") + ';color:' + f.color + '">' + f.label + '</span>'; }).join("") + '</div></td>'
                + '<td>' + statusBadge(t.status) + '</td>'
                + '</tr>';
            }).join("") + '</tbody></table></div>')
      + '</div>';
  }

  // ── Designer commitment scorecard ──────────────────────────
  var sprintWD = pace.totalWD || 65;
  var designerColumns = [
    { key:"designer",       label:"Designer",        align:"left" },
    { key:"committed",      label:"Committed",       align:"center" },
    { key:"delivered",      label:"Delivered",       align:"center" },
    { key:"utilisation",    label:"Utilisation",     align:"center" },
    { key:"sizing",         label:"Sizing",          align:"center" },
    { key:"deliveryRate",   label:"Delivery Rate",   align:"left" },
    { key:"missedDeadline", label:"Missed Deadline", align:"left", sortable:false },
  ];
  var designerRowsData = filteredDesigners().map(function(d) {
    var isExpanded = _vpExpandedDesigner === d.id;

    // Per-designer utilisation
    var myTs         = allTs.filter(function(t){ return t.assignee === d.id; });
    var myTicketDays = myTs.reduce(function(s,t){ return s + (SIZES[t.size] || SIZES.M || 3); }, 0);
    var myDaysOut    = daysOutFor(d.id, selectedQuarter);
    var myCapacity   = Math.max(1, sprintWD - myDaysOut);
    var myUtilPct    = Math.round(myTicketDays / myCapacity * 100);
    // A designer with days-out and light utilisation isn't a delivery risk, // they were expected to have less. Show grey (not red) and label the reason.
    var uColor;
    if (myUtilPct > 100) uColor = "var(--red)";
    else if (myUtilPct >= 80) uColor = "var(--amber)";
    else if (myUtilPct >= 50) uColor = "var(--green)";
    else uColor = myDaysOut > 0 ? "var(--t3)" : "var(--t2)";  // explicit "under because out" reads as neutral, not concerning
    var uTooltip = myTicketDays + " ticket-days assigned · " + myCapacity + " working days available"
                 + (myDaysOut > 0 ? " (after " + myDaysOut + " days out)" : "")
                 + ", click to set availability";

    // Size mix, compact stacked bar (small→large = light→dark, one sequential ramp since
    // size is ordinal). Full breakdown moves to the hover tooltip instead of always-on text.
    var SIZE_ASC   = ["S","M","L","XL","XXL"];
    var SIZE_SHADE = { S:"#c7d2fe", M:"#a5b4fc", L:"#818cf8", XL:"#6366f1", XXL:"#4338ca" };
    var sizeCounts = {};
    myTs.forEach(function(t){ var sz = t.size || "M"; sizeCounts[sz] = (sizeCounts[sz] || 0) + 1; });
    var sizeTotal  = myTs.length;
    var sizeSegments = SIZE_ASC.filter(function(sz){ return sizeCounts[sz]; }).map(function(sz) {
      var pct = sizeTotal ? (sizeCounts[sz] / sizeTotal * 100) : 0;
      return '<div style="width:' + pct + '%;height:100%;background:' + SIZE_SHADE[sz] + '"></div>';
    }).join("");
    // Rich hover card, legend explicitly names what each shade means (S=1d … XXL=20d),
    // replacing the plain OS title tooltip which can't show color-coded rows.
    var sizeTooltipHtml = !sizeTotal ? 'No tickets' :
      '<div style="font-weight:700;margin-bottom:5px;color:var(--t1)">' + sizeTotal + ' ticket' + (sizeTotal>1?'s':'') + ' · ' + myTicketDays + ' ticket-days</div>'
      + SIZE_ASC.filter(function(sz){ return sizeCounts[sz]; }).reverse().map(function(sz) {
          return '<div style="display:flex;align-items:center;gap:6px;padding:1px 0"><span style="width:9px;height:9px;border-radius:2px;background:' + SIZE_SHADE[sz] + ';flex-shrink:0"></span><span style="color:var(--t2)">' + sz + ' (' + SIZES[sz] + 'd) × ' + sizeCounts[sz] + '</span></div>';
        }).join("");
    var dTs = allTs.filter(function(t){ return t.assignee === d.id; });
    var dDone = dTs.filter(function(t){ return t.status === "Done"; }).length;
    var pct = dTs.length ? Math.round(dDone / dTs.length * 100) : 0;

    // Issues = only real risk: committed deadlines not met. This is the single definition
    // of "at risk" for this row, it drives the ⚠ badge next to the name, the pace color,
    // the Missed Deadline column, AND which tickets get highlighted when the row expands.
    // A ticket can carry other flags (Stale 2w+, No Update 3w+) without a missed deadline, // those show up in the ticket's own risk badges, but shouldn't flip this designer's
    // status to "at risk" here while the rest of the row shows nothing.
    var overdue  = dTs.filter(function(t){ return ticketFlags(t).some(function(f){ return f.label.indexOf("Overdue") !== -1; }); });
    var dueToday = dTs.filter(function(t){ return ticketFlags(t).some(function(f){ return f.label.indexOf("Due Today") !== -1; }); });
    var issues = [];
    if (overdue.length)  issues.push(overdue.length + " deadline" + (overdue.length > 1 ? "s" : "") + " missed");
    if (dueToday.length) issues.push(dueToday.length + " due today, not completed");
    var issueStr = issues.join(", ");

    // Combined "at risk" bucket, overdue + due today (used to flag rows within the full list)
    var riskTs = [].concat(overdue, dueToday.filter(function(t){ return overdue.indexOf(t) === -1; }));
    var isAtRisk = riskTs.length > 0;
    // Colour by pace, not by absolute completion. Individual delivery rate only turns red
    // when a designer actually missed a committed deadline, otherwise it's neutral or green.
    var pColor;
    if (!dTs.length)      pColor = "var(--t3)";
    else if (isAtRisk)    pColor = "var(--red)";
    else if (pace.tooEarly) pColor = "var(--t2)";
    else                  pColor = paceColor(pct, pace.expected, pace.tooEarly);
    var pm = POD_MANAGERS.find(function(p){ return p.pod === d.pod; });
    // Any row with tickets can be expanded to show the designer's full ticket list on demand, // not just the ones with a missed deadline. This is what a VP actually wants: "what is
    // this person working on," with every key clickable through to Jira.
    var canExpand = dTs.length > 0;
    var caret = canExpand ? (isExpanded ? " ▾" : " ▸") : "";
    var rowClickAttr = canExpand ? ' onclick="toggleVpDesigner(\'' + d.id + '\')" style="cursor:pointer' + (isExpanded ? ';background:var(--surface-2)' : '') + '"' : '';

    var cells = {
      designer: '<div style="display:flex;align-items:center;gap:8px">'
        + '<div style="width:30px;height:30px;border-radius:50%;background:' + dColor(d.id) + ';font-size:11px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
        + '<div>'
        + '<div style="display:flex;align-items:center;gap:6px">'
        + '<span style="font-size:12px;font-weight:700">' + d.name + '</span>'
        + (isAtRisk ? '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;background:#fde8e8;color:var(--red)">⚠</span>' : '')
        + '</div>'
        + (function() {
            var pod = podsConfig.find(function(p){ return p.designers.indexOf(d.id) !== -1; });
            return pod ? '<div style="font-size:10px;color:var(--t3)">' + pod.name + '</div>' : '';
          })()
        + '</div></div>',
      committed: '<span style="font-size:14px;font-weight:700;color:var(--t1)">' + dTs.length + '</span>',
      delivered: '<span style="font-size:14px;font-weight:700;color:var(--green)">' + dDone + '</span>',
      utilisation: '<div title="' + uTooltip + '" onclick="event.stopPropagation();promptDesignerAvailability(\'' + d.id + '\')" style="display:inline-flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;padding:4px 10px;border-radius:6px;transition:background .15s" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'transparent\'">'
        + '<span style="font-size:13px;font-weight:700;color:' + uColor + '">' + myUtilPct + '%</span>'
        + '<span style="font-size:9px;color:var(--t3)">' + myTicketDays + '/' + myCapacity + 'd' + (myDaysOut > 0 ? ' · -' + myDaysOut + ' OOO' : '') + '</span>'
        + '</div>',
      sizing: '<div onmouseenter="showCustomTooltip(event, ' + JSON.stringify(sizeTooltipHtml).replace(/"/g,"&quot;") + ')" onmousemove="positionCustomTooltip(event)" onmouseleave="hideCustomTooltip()" style="display:inline-flex;align-items:center;gap:8px;cursor:help">'
        + (sizeTotal ? '<div style="width:60px;height:5px;border-radius:3px;overflow:hidden;background:var(--border);flex-shrink:0;display:flex">' + sizeSegments + '</div>' : '<div style="width:60px;height:5px;border-radius:3px;background:var(--border);flex-shrink:0"></div>')
        + '<span style="font-size:13px;font-weight:700;color:var(--t1)">' + sizeTotal + '</span>'
        + '</div>',
      deliveryRate: '<div style="display:flex;align-items:center;gap:8px">'
        + '<div style="width:60px;height:5px;background:var(--border);border-radius:3px;overflow:hidden;flex-shrink:0"><div style="height:100%;width:' + pct + '%;background:' + pColor + ';border-radius:3px"></div></div>'
        + '<span style="font-size:13px;font-weight:700;color:' + pColor + '">' + pct + '%</span>'
        + '</div>',
      missedDeadline: issueStr
        ? '<span style="font-size:11px;color:var(--red);font-weight:700">' + issueStr + caret + '</span>'
        : (canExpand ? '<span style="font-size:11px;color:var(--t3)">, ' + caret + '</span>' : '<span style="font-size:11px;color:var(--t3)">, </span>'),
    };

    var expandedHtml = "";
    if (isExpanded && canExpand) {
      var riskKeys = new Set(riskTs.map(function(t){ return t.key; }));
      var sortedDTs = dTs.slice().sort(function(a,b){ return (a.hiFiEnd||"9999").localeCompare(b.hiFiEnd||"9999"); });
      var ticketList = sortedDTs.map(function(t) {
        var isRisky = riskKeys.has(t.key);
        var flags   = isRisky ? ticketFlags(t) : [];
        return '<div class="ticket-key-row" style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--bg)">'
          + '<span class="ticket-key">' + t.key + '</span>'
          + typePill(t.type)
          + '<span style="font-size:11px;color:var(--t1);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + t.summary + '</span>'
          + (isRisky ? flags.map(function(f){ return '<span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:4px;background:#fde8e8;color:var(--red);white-space:nowrap">' + f.label + '</span>'; }).join("") : '')
          + (t.hiFiEnd ? '<span style="font-size:10px;color:var(--t3);white-space:nowrap">Hi-Fi ' + t.hiFiEnd + '</span>' : '')
          + statusBadge(t.status)
          + '</div>';
      }).join("");
      expandedHtml = '<tr><td colspan="__COLSPAN__" style="padding:0"><div style="background:var(--surface-2);border-top:1px solid var(--border);padding:10px 20px 12px">'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">' + dTs.length + ' ticket' + (dTs.length>1?"s":"") + ' assigned to ' + d.name.split(" ")[0] + (riskTs.length ? ' · ' + riskTs.length + ' at risk' : '') + '</div>'
        + ticketList
        + '</div></td></tr>';
    }

    return {
      id: d.id,
      rowClickAttr: rowClickAttr,
      cells: cells,
      expandedHtml: expandedHtml,
      sortVals: {
        designer: d.name, committed: dTs.length, delivered: dDone,
        utilisation: myUtilPct, sizing: sizeTotal, deliveryRate: pct,
        missedDeadline: canExpand ? 1 : 0,
      },
    };
  });

  // ── Ticket-type breakdown ─────────────────────────────────
  var TYPE_ORDER = ["Feature", "UX Revamp", "Pattern", "UX Signoff", "UX Research"];
  var typeBuckets = {};
  allTs.forEach(function(t) {
    var typ = normalizeType(t.type) || "Other";
    if (!typeBuckets[typ]) typeBuckets[typ] = { total: 0, done: 0 };
    typeBuckets[typ].total++;
    if (t.status === "Done") typeBuckets[typ].done++;
  });
  var typesFound = TYPE_ORDER.filter(function(k){ return typeBuckets[k]; })
                             .concat(Object.keys(typeBuckets).filter(function(k){ return TYPE_ORDER.indexOf(k) === -1; }));
  // Compact readonly pills, single line, small footprint, no clickable affordance.
  var typeChips = typesFound.map(function(k) {
    var b   = typeBuckets[k];
    var col = TYPE_COLOR[k] || "var(--t2)";
    return '<div style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:var(--surface-2);border-radius:20px">'
      + '<span style="width:6px;height:6px;border-radius:50%;background:' + col + ';flex-shrink:0"></span>'
      + '<span style="font-size:10px;font-weight:600;color:var(--t2);white-space:nowrap">' + k + '</span>'
      + '<span style="font-size:10px;color:var(--t3);white-space:nowrap"><span style="font-weight:700;color:var(--t1)">' + b.done + '</span>/' + b.total + '</span>'
      + '</div>';
  }).join("");
  // Holiday calendar upload, sits adjacent to the type chips. Drives every working-day
  // calculation (sprint pace, utilisation) the moment a manager uploads a new list.
  var holidayControl = '<div style="display:inline-flex;align-items:center;gap:8px;flex-shrink:0">'
    + '<input type="file" accept=".csv,.txt" id="holiday-upload-input" style="display:none" onchange="handleHolidayUpload(this)">'
    + '<span style="font-size:10px;color:var(--t3);white-space:nowrap">' + (HOLIDAYS.length ? HOLIDAYS.length + ' holidays loaded' : 'Using default calendar') + '</span>'
    + '<button onclick="document.getElementById(\'holiday-upload-input\').click()" title="CSV, one date per line, format YYYY-MM-DD. Optional label after a comma." style="display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:700;padding:5px 12px;border:1px solid var(--border);border-radius:20px;background:var(--surface);color:var(--t2);cursor:pointer;white-space:nowrap">'
    +   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
    +   'Upload Holiday List'
    + '</button>'
    + '</div>';

  var typeSection = '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:var(--gap);align-items:center;justify-content:space-between">'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px">' + (allTs.length ? typeChips : '<span style="font-size:11px;color:var(--t3)">No tickets yet</span>') + '</div>'
    + holidayControl
    + '</div>';

  // ── Leadership signals, auto-derived insights a VP actually cares about ─────
  var signals = (function() {
    var out = [];
    var ds  = filteredDesigners();

    // 1. Reliability, % of tickets whose committed Hi-Fi date was met (Done by that date or still on track)
    var withDates = allTs.filter(function(t){ return t.hiFiEnd; });
    var missedCount = allTs.filter(function(t){ return ticketFlags(t).length > 0; }).length;
    var reliability = withDates.length ? Math.round((withDates.length - missedCount) / withDates.length * 100) : null;
    if (reliability !== null) {
      var relCol = reliability >= 85 ? "var(--green)" : reliability >= 65 ? "var(--amber)" : "var(--red)";
      out.push({ tone: relCol, kicker: "Reliability", value: reliability + "%",
        desc: reliability >= 85 ? "Team is meeting committed Hi-Fi dates consistently." :
              reliability >= 65 ? "Reliability slipping, " + missedCount + " committed dates missed." :
                                  "Reliability at risk, " + missedCount + " committed dates missed." });
    }

    // 2. Scope stability, how much came in mid-sprint
    var mid = midSprintTs.length;
    var stability = allTs.length ? Math.round(mid / allTs.length * 100) : 0;
    if (allTs.length) {
      var scopCol = stability <= 5 ? "var(--green)" : stability <= 15 ? "var(--amber)" : "var(--red)";
      out.push({ tone: scopCol, kicker: "Scope Stability",
        value: mid === 0 ? "Locked" : "+" + mid + " (" + stability + "%)",
        desc: mid === 0 ? "No tickets added after sprint kickoff, plan held." :
              stability <= 15 ? mid + " tickets added post-kickoff, normal churn." :
                                mid + " tickets added post-kickoff, plan drifted materially." });
    }

    // 3. Pod comparison, top and bottom pod by delivery %
    if (podsConfig.length >= 2) {
      var podStats = podsConfig.map(function(p) {
        var podDs = p.designers;
        var podTs = allTs.filter(function(t){ return podDs.indexOf(t.assignee) > -1; });
        var podDone = podTs.filter(function(t){ return t.status === "Done"; }).length;
        return { name: p.name, total: podTs.length, done: podDone, pct: podTs.length ? Math.round(podDone / podTs.length * 100) : 0 };
      }).filter(function(p){ return p.total > 0; }).sort(function(a,b){ return b.pct - a.pct; });
      if (podStats.length >= 2) {
        var lead = podStats[0], lag = podStats[podStats.length - 1];
        out.push({ tone: "var(--accent)", kicker: "Pod Leaderboard",
          value: lead.name.replace(/'s Pod$/,"").replace(/ Pod$/,""),
          desc: lead.name + " leads at " + lead.pct + "% delivered · " + lag.name + " trails at " + lag.pct + "%." });
      }
    }

    // 4. Type mix, where is the effort going
    var typeMix = Object.keys(typeBuckets).map(function(k){ return { k: k, total: typeBuckets[k].total }; })
                        .sort(function(a,b){ return b.total - a.total; });
    if (typeMix.length && allTs.length) {
      var top = typeMix[0];
      var topPct = Math.round(top.total / allTs.length * 100);
      out.push({ tone: TYPE_COLOR[top.k] || "var(--t2)", kicker: "Effort Mix",
        value: topPct + "% " + top.k,
        desc: topPct >= 50 ? "Half the sprint is " + top.k + " work, consider rebalancing." :
                             top.k + " is the biggest workstream (" + top.total + " of " + allTs.length + " tickets)." });
    }

    return out;
  })();

  var signalsSection = signals.length === 0 ? "" :
    '<div class="card" style="padding:14px 18px;margin-bottom:var(--gap)">'
    + '<div style="font-size:13px;font-weight:700;color:var(--t1);margin-bottom:2px">Sprint Signals</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px">Auto-derived headlines for leadership review</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">'
    +   signals.map(function(s){
          return '<div style="border-left:3px solid ' + s.tone + ';padding:6px 10px;background:var(--surface-2);border-radius:0 6px 6px 0">'
            + '<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)">' + s.kicker + '</div>'
            + '<div style="font-size:18px;font-weight:700;color:' + s.tone + ';margin:1px 0 3px">' + s.value + '</div>'
            + '<div style="font-size:11px;color:var(--t2);line-height:1.4">' + s.desc + '</div>'
            + '</div>';
        }).join("")
    + '</div></div>';

  _tableRerenderers["designerDelivery"] = renderVPSync;
  var designerTableApplied = applyTableConfig("designerDelivery", designerColumns, designerRowsData);
  var designerColByKey = {}; designerColumns.forEach(function(c){ designerColByKey[c.key] = c; });
  var designerBodyHtml = designerTableApplied.sortedRows.map(function(row) {
    var tr = '<tr' + row.rowClickAttr + '>'
      + designerTableApplied.visibleKeys.map(function(k) {
          var align = designerColByKey[k].align;
          return '<td' + (align && align !== "left" ? ' style="text-align:' + align + '"' : '') + '>' + row.cells[k] + '</td>';
        }).join("")
      + '</tr>';
    var expanded = row.expandedHtml ? row.expandedHtml.replace("__COLSPAN__", designerTableApplied.visibleKeys.length) : "";
    return tr + expanded;
  }).join("");

  var commitTable = '<div class="card" style="margin-bottom:var(--gap)">'
    + '<div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
    + '<div><div style="font-size:14px;font-weight:700">Delivery by Designer</div>'
    + '<div style="font-size:12px;color:var(--t3);margin-top:2px">Click a row with a missed deadline to see the affected tickets · click a column header to sort</div></div>'
    + columnConfigButton("designerDelivery")
    + '</div>'
    + '<div class="table-wrap"><table style="width:100%">'
    + '<thead>' + renderTableHead("designerDelivery", designerColumns) + '</thead>'
    + '<tbody>' + designerBodyHtml + '</tbody></table></div>'
    + '</div>';

  // "No misses" is only a real signal once the sprint has actually run long enough for a
  // deadline to have come and gone. In the first ~20% of a quarter nothing has had the
  // chance to be missed yet, celebrating that is misleading, not informative. Only show
  // this once there's a genuine track record (tickets with committed dates already in the
  // past) to point to.
  var pastDueTs = allTs.filter(function(t){ return t.hiFiEnd && t.hiFiEnd < TODAY; });
  var riskSection = (atRiskTs.length === 0 && !pace.tooEarly && pastDueTs.length > 0)
    ? '<div class="card" style="padding:16px 20px;margin-bottom:var(--gap);display:flex;align-items:center;gap:10px;color:var(--green)"><span style="font-size:16px">🎉</span><span style="font-size:13px;font-weight:600">All ' + pastDueTs.length + ' committed deadline' + (pastDueTs.length>1?'s':'') + ' met so far this sprint</span></div>'
    : '';

  // ── Q4 outlook ─────────────────────────────────────────────
  var q4Outlook = q4In > 0
    ? '<div class="card" style="padding:16px 20px;margin-bottom:var(--gap);display:flex;align-items:center;gap:16px">'
      + '<div style="font-size:24px">📅</div>'
      + '<div><div style="font-size:13px;font-weight:700">Next Quarter: ' + q4In + ' epics confirmed for Q4 cutline</div>'
      + '<div style="font-size:12px;color:var(--t3);margin-top:2px">Q4 planning is in progress. Confirm PRD readiness and assignments before Q3 closes.</div></div>'
      + '</div>'
    : '';

  // Sprint state next to the page heading, respects the real "current" quarter concept
  // (q.isCurrent), not the raw calendar q.status. This team starts real delivery a quarter
  // early (working OND while it's calendar-wise still JAS), so a quarter can be calendar
  // "planning" yet already have real committed work underway, showing "Sprint yet to
  // start" for a quarter real tickets already exist in was actively misleading.
  //   completed        → "Sprint completed <endDate> · ✓ Delivered"
  //   not yet current   → "Sprint yet to start · Starts <calendarStartDate>"
  //   current, no data yet → "Sprint just started <calendarStartDate>"
  //   current, real work started → "Sprint started <earliest real UX start date> · ✓ On track" (or ⚠ variants)
  var vpState = document.getElementById("vp-sprint-state");
  if (vpState && qObj) {
    var hasRisk = atRiskTs.length > 0;
    function fmt(d) { return new Date(d).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); }
    // Real start = earliest UX Start Date among this quarter's tickets, if any exist, // captures when work genuinely began, not the quarter's calendar boundary. Clamped to
    // no earlier than the previous quarter's start: uxStartDate falls back to the ticket's
    // raw Jira creation date when no real signal is mapped, and a ticket sitting in the
    // backlog since (say) 2025 would otherwise make a 2026 quarter appear to have "started"
    // over a year early. One quarter of early start is the most this team's own working
    // model allows for, so anything earlier than that is a bad signal, not a real start.
    var qIdx = QUARTERS.findIndex(function(q){ return q.id === qObj.id; });
    var earliestSaneStart = qIdx > 0 ? QUARTERS[qIdx - 1].start : qObj.start;
    var realStartDates = allTs.map(function(t){ return t.uxStartDate; }).filter(function(d){ return d && d >= earliestSaneStart; }).sort();
    var realStart = realStartDates.length ? realStartDates[0] : null;
    var state = "";
    if (qObj.displayCompleted) {
      state = '<span style="color:var(--t3)">Sprint completed ' + fmt(qObj.end) + '</span> · <span style="color:var(--green);font-weight:700">✓ Delivered</span>';
    } else if (!qObj.isCurrent) {
      state = '<span style="color:var(--t3)">Sprint yet to start · Starts ' + fmt(qObj.start) + '</span>';
    } else if (!realStart) {
      state = '<span style="color:var(--t3)">● Sprint just started ' + fmt(qObj.start) + '</span>';
    } else if (pace.tooEarly && !hasRisk) {
      state = '<span style="color:var(--t3)">● Sprint just started ' + fmt(realStart) + '</span>';
    } else {
      var stateColor, stateIcon;
      if (hasRisk)                             { stateColor = "var(--red)";   stateIcon = "⚠ " + atRiskTs.length + " deadline" + (atRiskTs.length>1?"s":"") + " missed"; }
      else if (paceMsg === "On pace")          { stateColor = "var(--green)"; stateIcon = "✓ On track"; }
      else if (paceMsg === "Slightly behind")  { stateColor = "var(--amber)"; stateIcon = "⚠ Slightly behind pace"; }
      else                                     { stateColor = "var(--red)";   stateIcon = "⚠ Behind pace"; }
      state = '<span style="color:var(--t3)">Sprint started ' + fmt(realStart) + '</span> · <span style="color:' + stateColor + ';font-weight:700">' + stateIcon + '</span>';
    }
    vpState.innerHTML = state;
  }

  document.getElementById("vpsync-content").innerHTML =
    '<div class="vp-wrap">'
    + metricsRow
    + typeSection
    + deviationsPanel
    + atRiskPanel
    + commitTable
    + riskSection
    + q4Outlook
    + '</div>';
}

// ── WEEKLY DIGEST ─────────────────────────────────────────────
function setDigestView(view) {
  digestView = view;
  renderDigest();
}

function renderDigest() {
  var deliveredKeys  = WEEKLY.delivered    || [];
  var missedKeys     = WEEKLY.missed       || [];
  var carry          = WEEKLY.carryForward || [];
  var planned        = WEEKLY.planned      || [];
  var atRisk         = WEEKLY.atRisk       || [];
  var nextWeek       = WEEKLY.nextWeek     || [];

  var deliveredItems = planned.filter(function(t){ return deliveredKeys.includes(t.key); });
  var missedItems    = planned.filter(function(t){ return missedKeys.includes(t.key); });
  var nextWeekFlags  = nextWeek.filter(function(t){ return t.flag; });

  function dMatch(t, d) { return t.assignee === d.id; }

  function personTag(assignee) {
    var d = DESIGNERS.find(function(d){ return d.id === assignee; });
    if (!d) return '<span style="font-size:12px;color:var(--t3)">' + assignee + '</span>';
    return '<span style="display:inline-flex;align-items:center;gap:5px">'
      + '<span style="width:18px;height:18px;border-radius:50%;background:' + dColor(d.id) + ';font-size:10px;font-weight:700;color:white;display:inline-flex;align-items:center;justify-content:center">' + initials(d.name) + '</span>'
      + '<span style="font-size:12px;color:var(--t2)">' + d.name.split(" ")[0] + '</span>'
      + '</span>';
  }

  function modTag(modId) {
    var m = moduleById(modId);
    return m ? '<span style="font-size:12px;color:var(--t3)">' + m.icon + ' ' + m.name + '</span>' : '';
  }

  function fmtDate(d) {
    if (!d) return "";
    var p = d.split("-"); // yyyy-mm-dd
    var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return months[parseInt(p[1],10)-1] + " " + parseInt(p[2],10);
  }

  function milestoneBar(ticketKey, currentStatus) {
    var full = TICKETS.find(function(t){ return t.key === ticketKey; });
    if (!full || !full.loFiEnd) return "";
    var milestones = [
      { short:"Lo-fi",  date: full.loFiEnd    },
      { short:"Hi-fi",  date: full.hiFiEnd    },
      { short:"Review", date: full.podReview  },
      { short:"Final",  date: full.finalReview},
    ];
    var stageIdx = currentStatus === "Done"        ? 4
                 : currentStatus === "In Review"   ? 2
                 : currentStatus === "In Progress" ? 1
                 : 0;

    var parts = milestones.map(function(m, i) {
      if (!m.date) return "";
      var isDone    = currentStatus === "Done" || i < stageIdx;
      var isCurrent = i === stageIdx;
      var isOverdue = m.date < TODAY && !isDone;
      var clr = isDone    ? "var(--green)"
              : isOverdue ? "var(--red)"
              : isCurrent ? "var(--accent)"
              : "var(--t3)";
      var wt  = isCurrent ? "600" : "400";
      var dot = isDone ? "✓" : isCurrent ? "●" : "○";
      return '<span style="color:' + clr + ';font-weight:' + wt + ';white-space:nowrap">'
        + dot + ' ' + m.short + ' ' + fmtDate(m.date)
        + '</span>';
    }).filter(Boolean);

    return '<div style="margin-top:6px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px">'
      + parts.join('<span style="color:var(--border);font-size:9px">›</span>')
      + '</div>';
  }

  function ticketRow(t, opts) {
    opts = opts || {};
    var status = t.status || (opts.status ? t.status : null);
    return '<div style="padding:12px 18px;border-top:1px solid var(--border)">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">'
      + '<span class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace">' + t.key + '</span>'
      + (moduleById(t.module) ? '<span style="color:var(--border)">·</span>' + modTag(t.module) : '')
      + (opts.status ? '<span style="color:var(--border)">·</span>' + statusBadge(t.status) : '')
      + '</div>'
      + '<div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:4px">' + t.summary + '</div>'
      + milestoneBar(t.key, t.status)
      + (opts.reason ? '<div style="margin-top:6px;padding:5px 8px;background:var(--red-bg);border-radius:var(--radius);font-size:10px;color:var(--red);font-weight:500">' + opts.reason + '</div>' : '')
      + (opts.flag   ? '<div style="margin-top:6px;padding:5px 8px;background:var(--red-bg);border-radius:var(--radius);font-size:10px;color:var(--red);font-weight:500">' + opts.flag + '</div>' : '')
      + '</div>';
  }

  // ── Shared banner ────────────────────────────────────────────
  var banner = '<div style="background:var(--sidebar-bg);border-radius:var(--radius);padding:16px 24px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">'
    + '<div>'
      + '<div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Weekly Delivery Snapshot</div>'
      + '<div style="font-size:14px;font-weight:700;color:white">' + WEEKLY.weekLabel + '</div>'
    + '</div>'
    + '<div style="display:flex;gap:28px">'
    + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--green)">' + deliveredKeys.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em">Delivered</div></div>'
    + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--red)">'   + missedKeys.length    + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em">Missed</div></div>'
    + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--blue)">'  + carry.length         + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em">Carry</div></div>'
    + '<div style="text-align:center"><div style="font-size:24px;font-weight:700;color:var(--amber)">' + atRisk.length        + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase;letter-spacing:.06em">At Risk</div></div>'
    + '</div></div>';

  // ── View toggle tabs ─────────────────────────────────────────
  var tabBar = '<div style="display:flex;gap:6px;margin-bottom:var(--gap);flex-wrap:wrap">';
  var isOverview = digestView === "overview";
  tabBar += '<button onclick="setDigestView(\'overview\')" style="padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:600;'
    + (isOverview ? 'background:var(--accent);color:white' : 'background:var(--surface-2);color:var(--t2)')
    + '">All Pods</button>';
  DESIGNERS.forEach(function(d) {
    var isActive = digestView === d.id;
    tabBar += '<button onclick="setDigestView(\'' + d.id + '\')" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:20px;border:none;cursor:pointer;font-size:12px;font-weight:600;'
      + (isActive ? 'background:' + d.color + ';color:white' : 'background:var(--surface-2);color:var(--t2)')
      + '">'
      + '<span style="width:16px;height:16px;border-radius:50%;background:' + (isActive ? 'rgba(255,255,255,0.3)' : d.color) + ';font-size:9px;font-weight:700;color:white;display:inline-flex;align-items:center;justify-content:center">' + initials(d.name) + '</span>'
      + d.name.split(" ")[0]
      + '</button>';
  });
  tabBar += '</div>';

  var html = banner + tabBar;

  // ══════════════════════════════════════════════════════════════
  //  BY DESIGNER view
  // ══════════════════════════════════════════════════════════════
  if (digestView !== "overview") {
    var d = DESIGNERS.find(function(d){ return d.id === digestView; });
    if (!d) { document.getElementById("digest-content").innerHTML = html; return; }

    var myDelivered = deliveredItems.filter(function(t){ return dMatch(t,d); });
    var myMissed    = missedItems.filter(function(t){ return dMatch(t,d); });
    var myCarry     = carry.filter(function(t){ return dMatch(t,d); });
    var myAtRisk    = atRisk.filter(function(t){ return t.assignee === d.id; });
    var myNext      = nextWeek.filter(function(t){ return t.assignee === d.id; });

    // designer header card
    html += '<div class="card" style="margin-bottom:var(--gap);border-left:4px solid ' + d.color + ';padding:20px 24px;display:flex;align-items:center;gap:18px">'
      + '<div style="width:56px;height:56px;border-radius:50%;background:' + d.color + ';font-size:18px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
      + '<div style="flex:1">'
        + '<div style="font-size:18px;font-weight:700;color:var(--t1)">' + d.name + '</div>'
        + '<div style="font-size:12px;color:var(--t3);margin-top:2px">' + (d.pod === "pod-a" ? "Pod A" : "Pod B") + ' · Designer</div>'
      + '</div>'
      + '<div style="display:flex;gap:20px">'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--green)">' + myDelivered.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Delivered</div></div>'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--red)">'   + myMissed.length    + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Missed</div></div>'
      + '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--blue)">'  + myCarry.length     + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Carry</div></div>'
      + (myAtRisk.length > 0 ? '<div style="text-align:center"><div style="font-size:28px;font-weight:700;color:var(--amber)">' + myAtRisk.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">At Risk</div></div>' : '')
      + '</div>'
      + '</div>';

    // Delivered + Missed (missed only shown if there are any)
    html += '<div style="display:grid;grid-template-columns:' + (myMissed.length > 0 ? '1fr 1fr' : '1fr') + ';gap:var(--gap);margin-bottom:var(--gap)">';

    html += '<div class="card" style="border-top:3px solid var(--green)">'
      + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
      + '<span style="font-size:12px;font-weight:700;color:var(--green)">✓ Delivered this week</span>'
      + '<span class="badge b-done">' + myDelivered.length + '</span></div>'
      + (myDelivered.length === 0
          ? '<div class="empty">Nothing delivered</div>'
          : myDelivered.map(function(t){ return ticketRow(t); }).join(""))
      + '</div>';

    if (myMissed.length > 0) {
      html += '<div class="card" style="border-top:3px solid var(--red)">'
        + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
        + '<span style="font-size:12px;font-weight:700;color:var(--red)">✗ Missed</span>'
        + '<span class="badge b-risk-r">' + myMissed.length + '</span></div>'
        + myMissed.map(function(t){ return ticketRow(t, { status:true, reason: t.missedReason || 'Planned but not delivered' }); }).join("")
        + '</div>';
    }

    html += '</div>';

    // carry forward
    if (myCarry.length > 0) {
      html += '<div class="card" style="margin-bottom:var(--gap);border-top:3px solid var(--blue)">'
        + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
        + '<span style="font-size:12px;font-weight:700;color:var(--blue)">→ Carrying Forward</span>'
        + '<span class="badge b-prog">' + myCarry.length + '</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0">'
        + myCarry.map(function(t){ return ticketRow(t, { status:true }); }).join("")
        + '</div></div>';
    }

    // at risk
    if (myAtRisk.length > 0) {
      html += '<div class="card" style="margin-bottom:var(--gap);border-top:3px solid var(--amber)">'
        + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
        + '<span style="font-size:12px;font-weight:700;color:var(--amber)">⚠ At Risk</span>'
        + '<span class="badge b-risk-a">' + myAtRisk.length + '</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0">'
        + myAtRisk.map(function(t){ return ticketRow(t, { flag: t.flag }); }).join("")
        + '</div></div>';
    }

    // next week
    if (myNext.length > 0) {
      var myNextFlags = myNext.filter(function(t){ return t.flag; });
      html += '<div class="card" style="border-top:3px solid var(--t2)">'
        + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
        + '<div>'
          + '<div style="font-size:12px;font-weight:700;color:var(--t1)">Next Week. Planned</div>'
          + (myNextFlags.length > 0 ? '<div style="font-size:10px;color:var(--amber);margin-top:2px">' + myNextFlags.length + ' ticket(s) need clarification</div>' : '')
        + '</div>'
        + '<span class="badge" style="background:var(--surface-2);color:var(--t2)">' + myNext.length + '</span></div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0">'
        + myNext.map(function(t){ return ticketRow(t, { flag: t.flag || null }); }).join('')
        + '</div></div>';
    }

    // nav: prev / next designer
    var idx = DESIGNERS.findIndex(function(x){ return x.id === d.id; });
    var prev = DESIGNERS[idx - 1];
    var next = DESIGNERS[idx + 1];
    html += '<div style="display:flex;justify-content:space-between;margin-top:var(--gap)">'
      + (prev ? '<button onclick="setDigestView(\'' + prev.id + '\')" style="padding:8px 18px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--t2);cursor:pointer;font-size:12px;font-weight:600">← ' + prev.name.split(" ")[0] + '</button>' : '<span></span>')
      + (next ? '<button onclick="setDigestView(\'' + next.id + '\')" style="padding:8px 18px;border-radius:20px;border:1px solid var(--border);background:var(--surface);color:var(--t2);cursor:pointer;font-size:12px;font-weight:600">' + next.name.split(" ")[0] + ' →</button>' : '<span></span>')
      + '</div>';

    document.getElementById("digest-content").innerHTML = html;
    return;
  }

  // ══════════════════════════════════════════════════════════════
  //  OVERVIEW view (All Pods)
  // ══════════════════════════════════════════════════════════════

  // ── This week, 3-col ────────────────────────────────────────
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--gap);margin-bottom:var(--gap)">';

  html += '<div class="card" style="border-top:3px solid var(--green)">'
    + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
    + '<span style="font-size:12px;font-weight:700;color:var(--green)">✓ Delivered</span>'
    + '<span class="badge b-done">' + deliveredKeys.length + '</span></div>'
    + (deliveredItems.length === 0
        ? '<div class="empty">None logged</div>'
        : deliveredItems.map(function(t){ return ticketRow(t); }).join(""))
    + '</div>';

  html += '<div class="card" style="border-top:3px solid var(--red)">'
    + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
    + '<span style="font-size:12px;font-weight:700;color:var(--red)">✗ Missed</span>'
    + '<span class="badge b-risk-r">' + missedKeys.length + '</span></div>'
    + (missedItems.length === 0
        ? '<div class="empty" style="color:var(--green)">All planned delivered</div>'
        : missedItems.map(function(t){ return ticketRow(t, { status: true, reason: t.missedReason || 'Planned but not delivered' }); }).join(""))
    + '</div>';

  html += '<div class="card" style="border-top:3px solid var(--blue)">'
    + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
    + '<span style="font-size:12px;font-weight:700;color:var(--blue)">→ Carry Forward</span>'
    + '<span class="badge b-prog">' + carry.length + '</span></div>'
    + (carry.length === 0
        ? '<div class="empty">Nothing carrying over</div>'
        : carry.map(function(t){ return ticketRow(t, { status: true }); }).join(""))
    + '</div>';

  html += '</div>';

  if (atRisk.length > 0) {
    html += '<div class="card" style="margin-bottom:var(--gap);border-top:3px solid var(--amber)">'
      + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
      + '<div>'
        + '<div style="font-size:12px;font-weight:700;color:var(--amber)">⚠ At Risk. Carry Forward</div>'
        + '<div style="font-size:10px;color:var(--t3);margin-top:2px">Items carrying forward with blockers, raise in Pod review</div>'
      + '</div>'
      + '<span class="badge b-risk-a">' + atRisk.length + '</span></div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:0">'
      + atRisk.map(function(t){ return ticketRow(t, { flag: t.flag }); }).join("")
      + '</div></div>';
  }

  // ── Designer Breakdown ───────────────────────────────────────
  html += '<div style="margin-bottom:var(--gap)">'
    + '<div style="font-size:14px;font-weight:700;margin-bottom:4px">Designer Breakdown</div>'
    + '<div style="font-size:12px;color:var(--t3);margin-bottom:12px">What each designer delivered this week, and what they missed</div>'
    + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap)">';

  html += DESIGNERS.map(function(d) {
    var myDelivered = deliveredItems.filter(function(t){ return dMatch(t,d); });
    var myMissed    = missedItems.filter(function(t){ return dMatch(t,d); });
    var myCarry     = carry.filter(function(t){ return dMatch(t,d); });

    var card = '<div class="card" style="display:flex;flex-direction:column">'
      + '<div style="padding:14px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border)">'
      + '<div style="width:36px;height:36px;border-radius:50%;background:' + dColor(d.id) + ';font-size:12px;font-weight:700;color:white;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</div>'
      + '<div style="min-width:0">'
        + '<div style="font-size:12px;font-weight:700;color:var(--t1)">' + d.name + '</div>'
        + '<div style="font-size:10px;color:var(--t3)">' + (d.pod==="pod-a"?"Pod A" : "Pod B") + '</div>'
      + '</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:var(--border)">'
      + '<div style="padding:8px 4px;background:var(--surface);text-align:center"><div style="font-size:16px;font-weight:700;color:var(--green)">' + myDelivered.length + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Done</div></div>'
      + '<div style="padding:8px 4px;background:var(--surface);text-align:center"><div style="font-size:16px;font-weight:700;color:var(--red)">'   + myMissed.length    + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Missed</div></div>'
      + '<div style="padding:8px 4px;background:var(--surface);text-align:center"><div style="font-size:16px;font-weight:700;color:var(--blue)">'  + myCarry.length     + '</div><div style="font-size:10px;color:var(--t3);text-transform:uppercase">Carry</div></div>'
      + '</div>';

    if (myDelivered.length > 0) {
      card += '<div style="padding:8px 18px 4px;font-size:10px;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:.06em">Delivered</div>'
        + myDelivered.map(function(t){
            return '<div style="padding:4px 18px 8px">'
              + '<div class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace">' + t.key + '</div>'
              + '<div style="font-size:12px;color:var(--t1)">' + t.summary + '</div>'
            + '</div>';
          }).join('');
    }

    if (myMissed.length > 0) {
      card += '<div style="padding:8px 18px 4px;font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.06em">Missed</div>'
        + myMissed.map(function(t){
            return '<div style="padding:4px 18px 8px">'
              + '<div class="ticket-key" style="font-size:10px;font-weight:700;color:var(--accent);font-family:monospace">' + t.key + '</div>'
              + '<div style="font-size:12px;color:var(--t1);margin-bottom:4px">' + t.summary + '</div>'
              + '<div style="padding:4px 8px;background:var(--red-bg);border-radius:var(--radius);font-size:10px;color:var(--red);font-weight:500">' + (t.missedReason || 'Planned but not delivered') + '</div>'
            + '</div>';
          }).join('');
    }

    if (myDelivered.length === 0 && myMissed.length === 0) {
      card += '<div style="padding:12px 18px;font-size:12px;color:var(--t3)">No planned tickets this week</div>';
    }

    card += '</div>';
    return card;
  }).join('');

  html += '</div></div>';

  // ── Next Week Planned ────────────────────────────────────────
  html += '<div class="card" style="border-top:3px solid var(--t2)">'
    + '<div style="padding:14px 18px 10px;display:flex;align-items:center;justify-content:space-between">'
    + '<div>'
      + '<div style="font-size:12px;font-weight:700;color:var(--t1)">Next Week. Planned</div>'
      + '<div style="font-size:10px;color:var(--t3);margin-top:2px">'
        + nextWeek.length + ' tickets planned'
        + (nextWeekFlags.length > 0 ? ' · <span style="color:var(--amber);font-weight:500">' + nextWeekFlags.length + ' need attention before Pod review</span>' : ' · No flags')
      + '</div>'
    + '</div>'
    + '<span class="badge" style="background:var(--surface-2);color:var(--t2)">' + nextWeek.length + '</span></div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:0">'
    + nextWeek.map(function(t){ return ticketRow(t, { flag: t.flag || null }); }).join('')
    + '</div></div>';

  document.getElementById("digest-content").innerHTML = html;
}

// ── Quarter selector ─────────────────────────────────────────
function onQuarterChange(val) {
  selectedQuarter  = val;
  expandedRisk     = null;
  expandedDesigner = null;
  riskFilter       = "all";
  updateTopbarBadges();
  navigate(currentPage, true);
}

function updateTopbarBadges() {
  var q = QUARTERS.find(function(q){ return q.id === selectedQuarter; });
  var sel = document.getElementById("quarter-sel");
  if (sel) sel.value = selectedQuarter;
  var dot = document.querySelector(".sb-sprint-dot");
  if (dot && q) {
    dot.style.background = q.status === "active" ? "var(--green)" : q.status === "planning" ? "var(--amber)" : "#555";
  }
  renderTopbarSprint();
}

// Renders the sprint dropdown+status pill beside the page title, and the last-synced
// stamp on the far right (single line).
function renderTopbarSprint() {
  var inline = document.getElementById("tb-sprint-inline");
  var right  = document.getElementById("tb-last-synced");
  if (!inline || !right) return;

  var q = QUARTERS.find(function(x){ return x.id === selectedQuarter; });
  var qIsCurrent  = q && q.isCurrent;
  var statusLabel = q ? (qIsCurrent ? "Current" : q.displayCompleted ? "Completed" : "Planning") : "";
  var statusColor = q ? (qIsCurrent ? "var(--accent)" : q.displayCompleted ? "var(--green)" : "var(--amber)") : "var(--t3)";
  var statusBg    = q ? (qIsCurrent ? "rgba(99,102,241,.12)" : q.displayCompleted ? "rgba(16,185,129,.12)" : "rgba(245,158,11,.12)") : "var(--surface-2)";

  inline.innerHTML =
    '<select onchange="onQuarterChange(this.value)" style="padding:5px 28px 5px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--t1);font-size:12px;font-weight:600;cursor:pointer;appearance:none;'
    + 'background-image:url(\'data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;12&quot; height=&quot;12&quot; viewBox=&quot;0 0 12 12&quot;><path fill=&quot;%23888&quot; d=&quot;M2 4l4 4 4-4&quot;/></svg>\');'
    + 'background-repeat:no-repeat;background-position:right 8px center">'
    + QUARTERS.map(function(qq){
        return '<option value="' + qq.id + '"' + (qq.id === selectedQuarter ? ' selected' : '') + '>'
          + qq.sprintName + ' · ' + qq.label
          + '</option>';
      }).join("")
    + '</select>'
    + '<span style="font-size:10px;font-weight:700;color:' + statusColor + ';padding:3px 8px;background:' + statusBg + ';border-radius:4px;text-transform:uppercase;letter-spacing:.04em">' + statusLabel + '</span>';

  var last = localStorage.getItem(JIRA_LAST_SYNC_KEY);
  right.innerHTML = last
    ? '<span style="color:var(--t3);font-weight:500">Last updated</span> <span title="' + new Date(last).toLocaleString() + '">' + timeAgo(new Date(last)) + '</span>'
    : '<span style="color:var(--t3)">Not synced yet</span>';
}

// ═══════════════════════════════════════════════════════════════
// JIRA INTEGRATION PLATFORM
// ═══════════════════════════════════════════════════════════════
var JIRA_CONFIG_KEY      = "designOps_jiraConfig";
var JIRA_FIELD_MAP_KEY   = "designOps_fieldMap";
var JIRA_DESIGNER_MAP_KEY= "designOps_designerMap";
var JIRA_LAST_SYNC_KEY   = "designOps_lastSync";
var JIRA_LIVE_DATA_KEY   = "designOps_liveData";
var DESIGNER_AVAIL_KEY   = "designOps_designerAvailability";

// Per-designer, per-quarter days-out-of-office. Manager can override to reflect leaves.
// Shape: { "<designerId>": { "<quarterId>": <days> } }
var designerAvailability = {};
function loadDesignerAvailability() {
  try { designerAvailability = JSON.parse(localStorage.getItem(DESIGNER_AVAIL_KEY) || "{}"); }
  catch (e) { designerAvailability = {}; }
}
function saveDesignerAvailability() {
  localStorage.setItem(DESIGNER_AVAIL_KEY, JSON.stringify(designerAvailability));
}
function daysOutFor(designerId, quarterId) {
  return (designerAvailability[designerId] && designerAvailability[designerId][quarterId]) || 0;
}
function setDaysOut(designerId, quarterId, days) {
  designerAvailability[designerId] = designerAvailability[designerId] || {};
  designerAvailability[designerId][quarterId] = Math.max(0, parseInt(days, 10) || 0);
  saveDesignerAvailability();
}
// Dialog-based editor invoked from a per-designer utilisation cell.
// Shows the manager the current capacity math, lets them adjust days-out,
// and previews how utilisation changes before they save.
function promptDesignerAvailability(designerId) {
  var d = designerById(designerId);
  if (!d) return;
  var q = QUARTERS.find(function(x){ return x.id === selectedQuarter; });
  if (!q) return;
  var totalWD  = workingDaysBetween(q.start, q.end);
  var current  = daysOutFor(designerId, selectedQuarter);
  var ticketDays = TICKETS.filter(function(t){ return t.assignee === d.id && t.quarter === selectedQuarter && t.scope !== "OUT"; })
                          .reduce(function(s,t){ return s + (SIZES[t.size] || SIZES.M || 3); }, 0);

  // Modal shell
  var existing = document.getElementById("avail-modal");
  if (existing) existing.remove();
  var modal = document.createElement("div");
  modal.id = "avail-modal";
  modal.style = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:3000;display:flex;align-items:center;justify-content:center";
  modal.innerHTML =
    '<div style="background:var(--surface);border-radius:12px;width:440px;max-width:92vw;box-shadow:0 24px 64px rgba(0,0,0,.35);overflow:hidden">'
    + '<div style="padding:18px 22px 16px;border-bottom:1px solid var(--border)">'
    +   '<div style="display:flex;align-items:center;gap:10px">'
    +     '<div style="width:36px;height:36px;border-radius:50%;background:' + dColor(d.id) + ';font-size:12px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center">' + initials(d.name) + '</div>'
    +     '<div><div style="font-size:15px;font-weight:700;color:var(--t1)">' + d.name + '\'s availability</div>'
    +     '<div style="font-size:11px;color:var(--t3);margin-top:1px">' + q.sprintName + ' · ' + q.label + ' · ' + totalWD + ' working days total</div></div>'
    +   '</div>'
    + '</div>'
    + '<div style="padding:18px 22px">'
    +   '<label style="display:block;font-size:12px;font-weight:600;color:var(--t2);margin-bottom:6px">Days unavailable this sprint</label>'
    +   '<input id="avail-days" type="number" min="0" max="' + totalWD + '" value="' + current + '" style="width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:6px;font-size:14px;background:var(--surface-2);color:var(--t1);box-sizing:border-box">'
    +   '<div style="font-size:11px;color:var(--t3);margin-top:6px">Include planned leave, public holidays specific to them, off-team time, anything that reduces this sprint\'s capacity.</div>'
    +   '<div id="avail-preview" style="margin-top:14px;padding:12px 14px;background:var(--surface-2);border-radius:6px;font-size:12px;color:var(--t2);line-height:1.5"></div>'
    + '</div>'
    + '<div style="padding:12px 22px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--surface-2)">'
    +   '<button onclick="setDaysOut(\'' + designerId + '\', selectedQuarter, 0); document.getElementById(\'avail-modal\').remove(); renderVPSync();" style="padding:6px 12px;font-size:11px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--red);cursor:pointer">Reset to 0</button>'
    +   '<div style="display:flex;gap:8px">'
    +     '<button onclick="document.getElementById(\'avail-modal\').remove()" style="padding:8px 16px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--t2);cursor:pointer">Cancel</button>'
    +     '<button onclick="saveAvailFromModal(\'' + designerId + '\')" style="padding:8px 20px;font-size:12px;font-weight:700;border:none;border-radius:6px;background:var(--accent);color:#fff;cursor:pointer">Save</button>'
    +   '</div>'
    + '</div>'
    + '</div>';
  document.body.appendChild(modal);
  modal.addEventListener("click", function(e){ if (e.target === modal) modal.remove(); });

  function updatePreview() {
    var days = Math.max(0, Math.min(totalWD, parseInt(document.getElementById("avail-days").value, 10) || 0));
    var effective = Math.max(1, totalWD - days);
    var util = Math.round(ticketDays / effective * 100);
    var col  = util > 100 ? "var(--red)" : util >= 80 ? "var(--amber)" : util >= 50 ? "var(--green)" : "var(--t2)";
    var label= util > 100 ? "Overloaded, expect slippage" :
               util >= 80 ? "High load, watch capacity" :
               util >= 50 ? "Healthy load" :
                            "Underloaded, has bandwidth" + (days > 0 ? " (light because they\'re out " + days + "d)" : "");
    document.getElementById("avail-preview").innerHTML =
      '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Ticket-days assigned</span><span style="font-weight:700;color:var(--t1)">' + ticketDays + 'd</span></div>'
      + '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>Effective capacity</span><span style="font-weight:700;color:var(--t1)">' + effective + 'd <span style="color:var(--t3);font-weight:500">(' + totalWD + ' − ' + days + ')</span></span></div>'
      + '<div style="display:flex;justify-content:space-between;padding-top:6px;border-top:1px solid var(--border);margin-top:6px"><span style="font-weight:600">New utilisation</span><span style="font-weight:700;color:' + col + ';font-size:14px">' + util + '% · ' + label + '</span></div>';
  }
  document.getElementById("avail-days").addEventListener("input", updatePreview);
  updatePreview();
  document.getElementById("avail-days").focus();
  document.getElementById("avail-days").select();
}

function saveAvailFromModal(designerId) {
  var val = document.getElementById("avail-days").value;
  setDaysOut(designerId, selectedQuarter, val);
  document.getElementById("avail-modal").remove();
  renderVPSync();
}

// Persist the post-sync state so demo data is never shown after a real Jira sync.
function saveLiveData() {
  try {
    var payload = {
      designers: DESIGNERS,
      tickets:   TICKETS,
      modules:   (typeof MODULES !== "undefined") ? MODULES : null,
      planning:  (typeof PLANNING_TICKETS !== "undefined") ? PLANNING_TICKETS : null,
      quartersCommitted: QUARTERS.map(function(q){ return { id: q.id, committed: q.committed }; }),
      weekly:    (typeof WEEKLY !== "undefined") ? WEEKLY : null,
      savedAt:   new Date().toISOString()
    };
    localStorage.setItem(JIRA_LIVE_DATA_KEY, JSON.stringify(payload));
  } catch(e) { /* quota etc., silently skip */ }
}

function loadLiveData() {
  try {
    var raw = localStorage.getItem(JIRA_LIVE_DATA_KEY);
    if (!raw) return false;
    var p = JSON.parse(raw);
    if (!p || !Array.isArray(p.designers) || !Array.isArray(p.tickets)) return false;
    DESIGNERS.length = 0; Array.prototype.push.apply(DESIGNERS, p.designers);
    TICKETS.length   = 0; Array.prototype.push.apply(TICKETS,   p.tickets);
    if (Array.isArray(p.modules) && typeof MODULES !== "undefined") {
      MODULES.length = 0; Array.prototype.push.apply(MODULES, p.modules);
    }
    if (typeof PLANNING_TICKETS !== "undefined") {
      PLANNING_TICKETS.length = 0;
      if (Array.isArray(p.planning)) Array.prototype.push.apply(PLANNING_TICKETS, p.planning);
    }
    // Purge any historical designerPerf that references dead demo designer ids
    var liveIds = new Set(DESIGNERS.map(function(d){ return d.id; }));
    QUARTERS.forEach(function(q) {
      if (Array.isArray(q.designerPerf)) q.designerPerf = q.designerPerf.filter(function(p){ return liveIds.has(p.id); });
    });
    (p.quartersCommitted || []).forEach(function(qc){
      var q = QUARTERS.find(function(x){ return x.id === qc.id; });
      if (q && typeof qc.committed === "number") q.committed = qc.committed;
    });
    if (p.weekly && typeof WEEKLY !== "undefined") {
      WEEKLY.weekLabel = p.weekly.weekLabel || WEEKLY.weekLabel;
      ["planned","delivered","missed","carryForward","atRisk","nextWeek"].forEach(function(k) {
        if (Array.isArray(p.weekly[k]) && Array.isArray(WEEKLY[k])) {
          WEEKLY[k].length = 0; Array.prototype.push.apply(WEEKLY[k], p.weekly[k]);
        }
      });
    }
    return true;
  } catch(e) { return false; }
}

// ══════════════════════════════════════════════════════════════
// ── Reusable Sortable / Configurable Table system
//    Any table can opt in: define columns once, hand it row data, get sortable
//    headers + a "⚙ Columns" popover (show/hide, reorder) + saved-per-table view,
//    persisted to localStorage so it survives reloads.
// ══════════════════════════════════════════════════════════════
var _tableConfigs      = {};  // tableId -> { order:[key], hidden:[key], sortKey, sortDir }
var _tableColumnDefs   = {};  // tableId -> columns array (last render's definition)
var _tableRerenderers  = {};  // tableId -> fn that re-renders the owning section

function _tableConfigKey(tableId) { return "designOps_tableConfig_" + tableId; }

function _loadTableConfig(tableId, columns) {
  var validKeys = columns.map(function(c){ return c.key; });
  var cfg = _tableConfigs[tableId];
  if (!cfg) {
    try { cfg = JSON.parse(localStorage.getItem(_tableConfigKey(tableId)) || "null"); } catch (e) { cfg = null; }
    if (!cfg) cfg = { order: validKeys.slice(), hidden: [], sortKey: null, sortDir: "asc" };
  }
  // Reconcile with the current column set, new columns appended, removed columns dropped.
  cfg.order  = cfg.order.filter(function(k){ return validKeys.indexOf(k) > -1; });
  validKeys.forEach(function(k){ if (cfg.order.indexOf(k) === -1) cfg.order.push(k); });
  cfg.hidden = (cfg.hidden || []).filter(function(k){ return validKeys.indexOf(k) > -1; });
  _tableConfigs[tableId] = cfg;
  _tableColumnDefs[tableId] = columns;
  return cfg;
}
function _saveTableConfig(tableId) {
  localStorage.setItem(_tableConfigKey(tableId), JSON.stringify(_tableConfigs[tableId]));
}
function _rerenderTable(tableId) {
  if (_tableRerenderers[tableId]) _tableRerenderers[tableId]();
}

function sortTableBy(tableId, key) {
  var cfg = _tableConfigs[tableId];
  if (!cfg) return;
  if (cfg.sortKey === key) cfg.sortDir = (cfg.sortDir === "asc") ? "desc" : "asc";
  else { cfg.sortKey = key; cfg.sortDir = "asc"; }
  _saveTableConfig(tableId);
  _rerenderTable(tableId);
}

function toggleTableColumn(tableId, key) {
  var cfg = _tableConfigs[tableId];
  if (!cfg) return;
  var idx = cfg.hidden.indexOf(key);
  if (idx > -1) cfg.hidden.splice(idx, 1);
  else cfg.hidden.push(key);
  _saveTableConfig(tableId);
  _renderColumnConfigPanel(tableId);
  _rerenderTable(tableId);
}

function moveTableColumn(tableId, key, dir) {
  var cfg = _tableConfigs[tableId];
  if (!cfg) return;
  var i = cfg.order.indexOf(key);
  var j = i + dir;
  if (i < 0 || j < 0 || j >= cfg.order.length) return;
  var tmp = cfg.order[i]; cfg.order[i] = cfg.order[j]; cfg.order[j] = tmp;
  _saveTableConfig(tableId);
  _renderColumnConfigPanel(tableId);
  _rerenderTable(tableId);
}

function resetTableConfig(tableId) {
  var columns = _tableColumnDefs[tableId] || [];
  _tableConfigs[tableId] = { order: columns.map(function(c){ return c.key; }), hidden: [], sortKey: null, sortDir: "asc" };
  _saveTableConfig(tableId);
  _renderColumnConfigPanel(tableId);
  _rerenderTable(tableId);
}

// Builds the sortable <thead> row for a table, respecting saved order/visibility.
function renderTableHead(tableId, columns) {
  var cfg = _loadTableConfig(tableId, columns);
  var byKey = {}; columns.forEach(function(c){ byKey[c.key] = c; });
  var visibleKeys = cfg.order.filter(function(k){ return cfg.hidden.indexOf(k) === -1; });
  return '<tr>' + visibleKeys.map(function(k) {
    var c = byKey[k];
    var sortable = c.sortable !== false;
    var isSorted = cfg.sortKey === k;
    var arrow = isSorted ? (cfg.sortDir === "asc" ? " ▲" : " ▼") : "";
    var style = (c.align ? "text-align:" + c.align + ";" : "") + (sortable ? "cursor:pointer;user-select:none" : "");
    var onclick = sortable ? ' onclick="sortTableBy(\'' + tableId + '\',\'' + k + '\')"' : "";
    return '<th' + (style ? ' style="' + style + '"' : "") + onclick + '>' + c.label + arrow + '</th>';
  }).join("") + '</tr>';
}

// Sorts + filters a rowsData array (each row must have a `.sortVals` map keyed by column key
// and a `.cells` map of pre-rendered HTML keyed by column key) per the saved config, and
// returns { visibleKeys, sortedRows } for the caller to render <td>s from.
function applyTableConfig(tableId, columns, rowsData) {
  var cfg = _loadTableConfig(tableId, columns);
  var visibleKeys = cfg.order.filter(function(k){ return cfg.hidden.indexOf(k) === -1; });
  var sorted = rowsData.slice();
  if (cfg.sortKey) {
    var dir = cfg.sortDir === "desc" ? -1 : 1;
    sorted.sort(function(a, b) {
      var av = a.sortVals[cfg.sortKey], bv = b.sortVals[cfg.sortKey];
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
      return ((av || 0) - (bv || 0)) * dir;
    });
  }
  return { visibleKeys: visibleKeys, sortedRows: sorted };
}

// "⚙ Columns" trigger button, sits in a table's card header.
function columnConfigButton(tableId) {
  return '<button onclick="openColumnConfig(\'' + tableId + '\', event)" title="Show, hide, or reorder columns" style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--t2);font-size:11px;font-weight:600;cursor:pointer">'
    + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    + 'Columns'
    + '</button>';
}

function openColumnConfig(tableId, e) {
  var panel = document.getElementById("col-config-panel");
  if (!panel) return;
  _renderColumnConfigPanel(tableId);
  panel.style.display = "block";
  var rect = e.target.closest("button").getBoundingClientRect();
  panel.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";
  panel.style.top  = (rect.bottom + 6) + "px";
}
function closeColumnConfig() {
  var panel = document.getElementById("col-config-panel");
  if (panel) panel.style.display = "none";
}
function _renderColumnConfigPanel(tableId) {
  var panel = document.getElementById("col-config-panel");
  if (!panel) return;
  panel.dataset.tableId = tableId;
  var cfg = _tableConfigs[tableId];
  var columns = _tableColumnDefs[tableId] || [];
  var byKey = {}; columns.forEach(function(c){ byKey[c.key] = c; });
  var rows = cfg.order.map(function(k, i) {
    var c = byKey[k];
    if (!c) return "";
    var hidden = cfg.hidden.indexOf(k) > -1;
    return '<div style="display:flex;align-items:center;gap:6px;padding:5px 4px;border-radius:5px" onmouseover="this.style.background=\'var(--surface-2)\'" onmouseout="this.style.background=\'transparent\'">'
      + '<input type="checkbox" ' + (hidden ? "" : "checked") + ' onchange="toggleTableColumn(\'' + tableId + '\',\'' + k + '\')" style="cursor:pointer">'
      + '<span style="flex:1;font-size:12px;color:' + (hidden ? "var(--t3)" : "var(--t1)") + '">' + c.label + '</span>'
      + '<button onclick="moveTableColumn(\'' + tableId + '\',\'' + k + '\',-1)" ' + (i === 0 ? "disabled" : "") + ' style="border:none;background:none;color:var(--t3);cursor:pointer;font-size:11px;padding:2px 4px;opacity:' + (i===0?"0.3":"1") + '">▲</button>'
      + '<button onclick="moveTableColumn(\'' + tableId + '\',\'' + k + '\',1)" ' + (i === cfg.order.length-1 ? "disabled" : "") + ' style="border:none;background:none;color:var(--t3);cursor:pointer;font-size:11px;padding:2px 4px;opacity:' + (i===cfg.order.length-1?"0.3":"1") + '">▼</button>'
      + '</div>';
  }).join("");
  panel.innerHTML = '<div style="padding:10px 12px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
    + '<span style="font-size:11px;font-weight:700;color:var(--t2)">Columns</span>'
    + '<button onclick="resetTableConfig(\'' + tableId + '\')" style="font-size:10px;color:var(--t3);border:none;background:none;cursor:pointer">Reset</button>'
    + '</div>'
    + '<div style="padding:6px 8px;max-height:280px;overflow-y:auto">' + rows + '</div>'
    + '<div style="padding:8px 12px;border-top:1px solid var(--border);font-size:10px;color:var(--t3)">Saved automatically, this view persists next time you open the app.</div>';
}
// Click-outside-to-close, guarded against a drag/selection that starts inside and ends outside.
var _colConfigMouseDownOutside = false;
document.addEventListener("mousedown", function(e) {
  var panel = document.getElementById("col-config-panel");
  if (!panel || panel.style.display === "none") return;
  _colConfigMouseDownOutside = !panel.contains(e.target) && !e.target.closest('[onclick*="openColumnConfig"]');
});
document.addEventListener("click", function(e) {
  var panel = document.getElementById("col-config-panel");
  if (!panel || panel.style.display === "none") return;
  var clickedTrigger = e.target.closest('[onclick*="openColumnConfig"]');
  if (_colConfigMouseDownOutside && !panel.contains(e.target) && !clickedTrigger) closeColumnConfig();
});

function clearLiveData() {
  localStorage.removeItem(JIRA_LIVE_DATA_KEY);
}

// ══════════════════════════════════════════════════════════════
// ── Ticket Detail Panel, read-only view + comments, with a
//    single explicit "Open in Jira" button for anything that needs editing.
// ══════════════════════════════════════════════════════════════
function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// Minimal Atlassian Document Format (ADF) → HTML renderer.
// Covers the node types that show up in real Jira descriptions/comments;
// anything unrecognised falls through to rendering its children so nothing silently vanishes.
function adfToHtml(node) {
  if (!node) return "";
  if (typeof node === "string") return escapeHtml(node);
  var type = node.type;
  var content = node.content || [];
  function kids() { return content.map(adfToHtml).join(""); }
  switch (type) {
    case "doc":        return kids();
    case "paragraph":  return '<p style="margin:0 0 8px">' + kids() + '</p>';
    case "text":
      var text = escapeHtml(node.text || "");
      (node.marks || []).forEach(function(m) {
        if (m.type === "strong") text = "<strong>" + text + "</strong>";
        else if (m.type === "em") text = "<em>" + text + "</em>";
        else if (m.type === "code") text = '<code style="background:var(--surface-2);padding:1px 4px;border-radius:3px">' + text + "</code>";
        else if (m.type === "link" && m.attrs && m.attrs.href) text = '<a href="' + escapeHtml(m.attrs.href) + '" target="_blank" rel="noopener" style="color:var(--accent)">' + text + "</a>";
      });
      return text;
    case "hardBreak":   return "<br>";
    case "bulletList":  return '<ul style="margin:0 0 8px;padding-left:18px">' + kids() + '</ul>';
    case "orderedList": return '<ol style="margin:0 0 8px;padding-left:18px">' + kids() + '</ol>';
    case "listItem":    return '<li>' + kids() + '</li>';
    case "blockquote":  return '<blockquote style="margin:0 0 8px;padding-left:10px;border-left:2px solid var(--border);color:var(--t3)">' + kids() + '</blockquote>';
    case "codeBlock":   return '<pre style="background:var(--surface-2);padding:8px;border-radius:6px;overflow-x:auto;font-size:11px"><code>' + kids() + '</code></pre>';
    case "heading":
      var lvl = (node.attrs && node.attrs.level) || 3;
      return '<div style="font-weight:700;font-size:' + Math.max(12, 16 - lvl) + 'px;margin:0 0 6px">' + kids() + '</div>';
    case "mention":     return '<span style="color:var(--accent);font-weight:600">@' + escapeHtml((node.attrs && node.attrs.text) || "user") + '</span>';
    case "emoji":       return escapeHtml((node.attrs && node.attrs.text) || "");
    case "rule":        return '<hr style="border:none;border-top:1px solid var(--border);margin:10px 0">';
    default:            return kids();
  }
}

// ── Shared custom hover tooltip, used wherever a rich (color-coded, multi-line)
// hint is needed instead of the plain, unstylable native `title` attribute.
function showCustomTooltip(e, html) {
  var el = document.getElementById("custom-tooltip");
  if (!el) return;
  el.innerHTML = html;
  el.style.display = "block";
  positionCustomTooltip(e);
}
function positionCustomTooltip(e) {
  var el = document.getElementById("custom-tooltip");
  if (!el || el.style.display === "none") return;
  var rect = el.getBoundingClientRect();
  var gap = 10;
  // Default: centered above the cursor, like a native tooltip anchored to the hovered point.
  var x = e.clientX - rect.width / 2;
  var y = e.clientY - rect.height - gap;
  // If there isn't room above, flip below instead of drifting away from the cursor.
  if (y < 4) y = e.clientY + gap;
  // Keep horizontally on-screen without losing the cursor-relative anchoring.
  if (x < 4) x = 4;
  if (x + rect.width > window.innerWidth - 4) x = window.innerWidth - rect.width - 4;
  el.style.left = x + "px";
  el.style.top = y + "px";
}
function hideCustomTooltip() {
  var el = document.getElementById("custom-tooltip");
  if (el) el.style.display = "none";
}

function _tpErr(msg) {
  return '<div style="font-size:11px;color:var(--red);text-align:center;padding:12px">✗ ' + escapeHtml(msg) + '</div>';
}

function openTicketPanel(key) {
  var overlay = document.getElementById("ticket-panel-overlay");
  var panel   = document.getElementById("ticket-panel");
  if (!overlay || !panel) return;
  var t = TICKETS.find(function(x){ return x.key === key; })
    || (typeof PLANNING_TICKETS !== "undefined" ? PLANNING_TICKETS.find(function(x){ return x.key === key; }) : null);
  panel.innerHTML = _renderTicketPanelShell(key, t);
  overlay.style.display = "block";

  var cfg = loadJiraConfig();
  if (cfg.url) {
    _fetchTicketPanelDetails(key, cfg, t);
  } else {
    var body = document.getElementById("tp-live-section");
    if (body) body.innerHTML =
      '<div style="text-align:center;padding:16px;color:var(--t3);font-size:12px">Connect Jira in Settings to load description &amp; comments.'
      + '<div style="margin-top:10px"><button onclick="closeTicketPanel();openSettings()" style="padding:6px 14px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:11px;font-weight:700;cursor:pointer">Open Settings</button></div></div>';
  }
}

function closeTicketPanel() {
  var overlay = document.getElementById("ticket-panel-overlay");
  if (overlay) overlay.style.display = "none";
}

// Same "mousedown AND click both on the backdrop" guard used elsewhere, prevents an
// accidental close when a drag/selection that starts inside the panel ends outside it.
var _tpMouseDownOnOverlay = false;
document.addEventListener("mousedown", function(e) {
  var ov = document.getElementById("ticket-panel-overlay");
  _tpMouseDownOnOverlay = !!(ov && e.target === ov);
});
document.addEventListener("click", function(e) {
  var ov = document.getElementById("ticket-panel-overlay");
  if (ov && e.target === ov && _tpMouseDownOnOverlay) closeTicketPanel();
  _tpMouseDownOnOverlay = false;
});

function _tpFieldPill(flag) {
  if (!flag) return "";
  return '<span style="font-size:9px;font-weight:700;padding:1px 7px;border-radius:999px;background:' + (flag.color==="var(--red)"?"#fde8e8":"#fef3c7") + ';color:' + flag.color + '">' + flag.label + '</span>';
}
function _tpField(label, value, color, sub, flag) {
  if (!value) return "";
  return '<div style="text-align:left"><div style="color:var(--t3);font-size:9px;font-weight:700;margin-bottom:2px">' + label + '</div>'
    + '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-weight:700;color:' + (color || "var(--t1)") + '">' + value + '</span>' + _tpFieldPill(flag) + '</div>'
    + (sub ? '<div style="font-size:10px;font-weight:600;margin-top:1px;color:' + sub.color + '">' + sub.text + '</div>' : '')
    + '</div>';
}

// A ticket only "counts" as started once its UX Start Date has actually arrived, // most tickets churn on dates/scope while still being triaged/queued across quarters
// before real work begins, and that pre-start churn isn't a useful signal to surface.
function _hasStarted(t) {
  return !!(t && t.uxStartDate && t.uxStartDate <= TODAY);
}
// Changes that happened once work was actually underway, filters out pre-scoping noise.
// Strictly AFTER uxStartDate (not >=): when no real Jira field is mapped, uxStartDate is
// derived from the ticket's own scope-change-to-IN event, so an inclusive comparison made
// that triggering event double-count itself as a "deviation" on nearly every ticket, // wildly inflating the Scope Deviations total.
function _postStartChanges(t) {
  if (!_hasStarted(t)) return [];
  return (t.changeHistory || []).filter(function(c){ return c.date > t.uxStartDate; });
}

// Renders the change-log list, newest first, each row names who and what. Left-aligned
// throughout (explicit, not inherited) so wrapped lines don't drift under the pill.
function _renderChangeHistory(changeHistory) {
  if (!changeHistory || !changeHistory.length) {
    return '<div style="font-size:11px;color:var(--t3);font-style:italic;text-align:left">No changes since work started</div>';
  }
  var KIND_LABEL = { date:"Date", scope:"Scope", size:"Size" };
  var KIND_COLOR = { date:"var(--amber)", scope:"var(--red)", size:"var(--accent)" };
  var KIND_BG    = { date:"#fef3c7", scope:"#fde8e8", size:"var(--accent-t1, #e0e7ff)" };
  return changeHistory.map(function(c) {
    var col = KIND_COLOR[c.kind] || "var(--t2)";
    var bg  = KIND_BG[c.kind] || "var(--surface-2)";
    return '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--bg);text-align:left">'
      + '<span style="font-size:9px;font-weight:700;padding:3px 8px;border-radius:999px;background:' + bg + ';color:' + col + ';flex-shrink:0;text-align:center;white-space:nowrap;margin-top:1px">' + (KIND_LABEL[c.kind] || c.field) + '</span>'
      + '<div style="flex:1;min-width:0;font-size:11px;color:var(--t2);line-height:1.5;text-align:left;overflow-wrap:break-word;word-break:break-word">'
      +   '<strong style="color:var(--t1)">' + escapeHtml(c.by) + '</strong> changed <strong>' + escapeHtml(c.field) + '</strong>: '
      +   escapeHtml(c.from) + ' → ' + escapeHtml(c.to)
      +   '<span style="color:var(--t3)"> · ' + c.date + '</span>'
      + '</div>'
      + '</div>';
  }).join("");
}

function _renderTicketPanelShell(key, t) {
  var cfg = loadJiraConfig();
  var jiraUrl = cfg.url ? cfg.url.replace(/\/$/, "") + "/browse/" + key : null;
  var d = t ? designerById(t.assignee) : null;
  var m = t ? moduleById(t.module) : null;
  var flags = t ? ticketFlags(auditTicket(t)) : [];

  // UX Effort, size + day-equivalent, plus a live "days left / overdue" readout computed
  // from working days elapsed since the ticket's UX Start Date.
  var effortLabel = t && t.size ? t.size + ' · ' + (SIZES[t.size] || 3) + 'd' : '';
  var effortSub = null;
  if (t && t.size && t.uxStartDate && t.uxStartDate <= TODAY && t.status !== "Done") {
    var totalDays   = SIZES[t.size] || 3;
    var elapsedWD   = Math.max(0, workingDaysBetween(t.uxStartDate, TODAY));
    var remainingWD = totalDays - elapsedWD;
    // A remaining figure far outside the estimate (e.g. -179d on a 20d ticket) means the
    // start-date signal is unreliable for this ticket, not a genuine 179-day overrun, // show a neutral prompt instead of an alarming, meaningless number.
    if (remainingWD < -totalDays) effortSub = { text: "needs date review", color: "var(--t3)" };
    else if (remainingWD < 0)      effortSub = { text: Math.abs(remainingWD) + "d overdue", color: "var(--red)" };
    else if (remainingWD === 0)    effortSub = { text: "due today", color: "var(--amber)" };
    else if (remainingWD <= 2)     effortSub = { text: remainingWD + "d left", color: "var(--amber)" };
    else                           effortSub = { text: remainingWD + "d left", color: "var(--green)" };
  } else if (t && t.status === "Done") {
    effortSub = { text: "Completed", color: "var(--green)" };
  }

  var started = _hasStarted(t);
  var visibleChanges = _postStartChanges(t);

  // Attach each risk flag to the specific date field it's about, shown as a small inline
  // pill next to that field's value, rather than one dedicated strip repeating labels
  // that already point at a date the reader can see right above it.
  var hiFiFlag = flags.find(function(f){ return f.reason && f.reason.indexOf("Hi-Fi") !== -1; });
  var loFiFlag = flags.find(function(f){ return f.reason && f.reason.indexOf("Lo-Fi") !== -1; });
  var frFlag   = flags.find(function(f){ return f.reason && f.reason.indexOf("Final Review") !== -1; });
  var otherFlags = flags.filter(function(f){ return f !== hiFiFlag && f !== loFiFlag && f !== frFlag; });

  return '<div style="position:sticky;top:0;z-index:2;background:var(--surface);padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:10px">'
    +   '<div style="min-width:0">'
    +     '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    +       '<span style="font-family:monospace;font-weight:700;color:var(--accent);font-size:13px">' + key + '</span>'
    +       (t ? typePill(t.type) : '')
    +       (t ? stageBadge(t) : '')
    +     '</div>'
    +     '<div style="font-size:15px;font-weight:700;color:var(--t1);margin-top:6px;line-height:1.4">' + escapeHtml(t ? t.summary : "Loading…") + '</div>'
    +   '</div>'
    +   '<button onclick="closeTicketPanel()" style="border:none;background:none;font-size:20px;color:var(--t3);cursor:pointer;padding:2px 6px;line-height:1;flex-shrink:0">×</button>'
    + '</div>'
    + '<div style="padding:14px 20px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:11px;color:var(--t2)">'
    +   '<div style="text-align:left"><div style="color:var(--t3);font-size:9px;font-weight:700;margin-bottom:2px">Assignee</div>'
    +     (d ? '<div style="display:flex;align-items:center;gap:6px;font-weight:700;color:var(--t1)"><span style="width:20px;height:20px;border-radius:50%;background:' + dColor(d.id) + ';color:#fff;font-size:8px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(d.name) + '</span>' + escapeHtml(d.name) + '</div>' : '<div style="color:var(--t3)">, </div>')
    +   '</div>'
    +   '<div style="text-align:left"><div style="color:var(--t3);font-size:9px;font-weight:700;margin-bottom:2px">Module</div>'
    +     (m ? '<div style="display:flex;align-items:center;gap:5px;font-weight:700;color:' + m.color + '">' + m.icon + ' ' + escapeHtml(m.name) + '</div>' : '<div style="color:var(--t3)">, </div>')
    +   '</div>'
    +   _tpField("UX Effort", effortLabel, null, effortSub, otherFlags[0])
    +   _tpField("UX Start Date", t && t.uxStartDate)
    +   _tpField("Lo-Fi Committed Date", t && t.loFiEnd, loFiFlag ? loFiFlag.color : null, null, loFiFlag)
    +   _tpField("Hi-Fi Committed Date", t && t.hiFiEnd, hiFiFlag ? hiFiFlag.color : null, null, hiFiFlag)
    +   _tpField("Final Review Date", t && t.finalReviewDate, frFlag ? frFlag.color : null, null, frFlag)
    + '</div>'
    + '<div id="tp-live-section" style="padding:16px 20px;text-align:left;border-bottom:1px solid var(--border)">'
    +   '<div style="text-align:center;padding:20px;color:var(--t3);font-size:12px">Loading description &amp; comments…</div>'
    + '</div>'
    // History only shows once the ticket's UX work has actually started, pre-start
    // date/scope churn while a ticket is still being queued isn't a useful signal.
    + (started ? '<div id="tp-change-section" style="padding:14px 20px;border-bottom:1px solid var(--border);text-align:left">'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:8px">History<span id="tp-change-count" style="color:var(--t3);font-weight:500"></span></div>'
        + '<div id="tp-change-history">' + _renderChangeHistory(visibleChanges) + '</div>'
        + '</div>' : '')
    + (jiraUrl ? '<div style="position:sticky;bottom:0;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface)">'
        + '<a href="' + jiraUrl + '" target="_blank" rel="noopener" style="display:block;text-align:center;padding:8px;border-radius:6px;border:1px solid var(--border);background:var(--surface-2);color:var(--t2);font-size:12px;font-weight:600;text-decoration:none">Open in Jira ↗</a>'
        + '</div>' : '');
}

function _fetchTicketPanelDetails(key, cfg, localTicket) {
  var fieldMap = loadFieldMap();
  var path = "/rest/api/3/issue/" + encodeURIComponent(key) + "?fields=description,comment,summary,status&expand=changelog";
  jiraFetch(cfg, path)
    .then(function(r){ return r.text().then(function(txt){ return { ok:r.ok, status:r.status, txt:txt }; }); })
    .then(function(res){
      var body = document.getElementById("tp-live-section");
      if (!body) return;
      if (res.txt.trim().startsWith("<")) { body.innerHTML = _tpErr("Jira returned an HTML page, check your credentials."); return; }
      var data;
      try { data = JSON.parse(res.txt); } catch(e) { body.innerHTML = _tpErr("Unexpected response from Jira."); return; }
      if (!res.ok) { body.innerHTML = _tpErr("HTTP " + res.status + ", " + (data.errorMessages || [data.message || "could not load"]).join(", ")); return; }

      var f = data.fields || {};
      var descHtml = f.description ? adfToHtml(f.description) : '<span style="color:var(--t3);font-style:italic">No description</span>';
      var comments = (f.comment && f.comment.comments) || [];
      var commentsHtml = comments.length === 0
        ? '<div style="font-size:11px;color:var(--t3);font-style:italic">No comments yet</div>'
        : comments.map(function(c) {
            var author = c.author ? c.author.displayName : "Unknown";
            var when = c.created ? new Date(c.created).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }) : "";
            return '<div style="padding:10px 0;border-bottom:1px solid var(--bg)">'
              + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:11px;font-weight:700;color:var(--t1)">' + escapeHtml(author) + '</span><span style="font-size:10px;color:var(--t3)">' + when + '</span></div>'
              + '<div style="font-size:12px;color:var(--t2);line-height:1.5">' + adfToHtml(c.body) + '</div>'
              + '</div>';
          }).join("");

      body.innerHTML =
        '<div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:8px">Description</div>'
        + '<div style="font-size:12px;color:var(--t2);line-height:1.6">' + descHtml + '</div>'
        + '<div style="border-top:1px solid var(--bg);margin:16px 0"></div>'
        + '<div style="font-size:10px;font-weight:700;color:var(--t3);margin-bottom:8px">Comments (' + comments.length + ')</div>'
        + commentsHtml;

      // Refresh History with the authoritative live changelog (fills in anything the
      // last bulk sync missed), but keep the same "only after work started" gate.
      var changeInfo = extractChangeHistory(data, fieldMap);
      var histEl  = document.getElementById("tp-change-history");
      var countEl = document.getElementById("tp-change-count");
      if (histEl) {
        var startDate = localTicket && localTicket.uxStartDate;
        var visible = (startDate && startDate <= TODAY)
          ? changeInfo.changeHistory.filter(function(c){ return c.date >= startDate; })
          : changeInfo.changeHistory;
        histEl.innerHTML = _renderChangeHistory(visible);
        if (countEl) countEl.textContent = visible.length ? ", " + visible.length + " tracked" : "";
      }
    })
    .catch(function(e) {
      var body = document.getElementById("tp-live-section");
      if (body) body.innerHTML = _tpErr(e.message);
    });
}

// ══════════════════════════════════════════════════════════════
// ── Holiday calendar upload, managers upload a CSV once a year;
//    every working-day calculation (sprint pace, utilisation) picks it up automatically.
// ══════════════════════════════════════════════════════════════
var HOLIDAY_STORAGE_KEY = "designOps_customHolidays";

function loadHolidaysFromStorage() {
  try {
    var raw = localStorage.getItem(HOLIDAY_STORAGE_KEY);
    if (!raw) return;
    var arr = JSON.parse(raw);
    if (Array.isArray(arr) && typeof HOLIDAYS !== "undefined") {
      HOLIDAYS.length = 0;
      Array.prototype.push.apply(HOLIDAYS, arr);
    }
  } catch (e) { /* keep whatever HOLIDAYS already has */ }
}

function saveHolidaysToStorage() {
  localStorage.setItem(HOLIDAY_STORAGE_KEY, JSON.stringify(HOLIDAYS));
}

// Accepts one date per line, "YYYY-MM-DD" or "YYYY-MM-DD,Label". Falls back to
// native Date parsing for other formats, but ISO is the documented/expected format.
function parseHolidayCSV(text) {
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  var dates = [];
  String(text).split(/\r?\n/).forEach(function(line) {
    line = line.trim();
    if (!line) return;
    var candidate = line.split(",")[0].trim();
    if (iso.test(candidate)) { dates.push(candidate); return; }
    var d = new Date(candidate);
    if (!isNaN(d.getTime())) dates.push(d.toISOString().slice(0, 10));
  });
  return Array.from(new Set(dates)).sort();
}

function handleHolidayUpload(input) {
  var file = input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    var parsed = parseHolidayCSV(String(e.target.result || ""));
    if (!parsed.length) {
      alert("No valid dates found. Use one date per line, format YYYY-MM-DD, optionally followed by a comma and a label.");
      return;
    }
    HOLIDAYS.length = 0;
    Array.prototype.push.apply(HOLIDAYS, parsed);
    saveHolidaysToStorage();
    if (currentPage === "vpsync") renderVPSync();
    else navigate(currentPage, false);
  };
  reader.readAsText(file);
  input.value = "";  // allow re-uploading the same filename later
}

// Wipe every trace of seed / demo data. Keeps only tickets & designers that came from
// a real Jira sync (marked with _fromJira). After running, persists the cleaned state so
// it survives page reloads.
function clearAllDemoData() {
  var jiraDesignerIds = new Set(DESIGNERS.filter(function(d){ return d._fromJira; }).map(function(d){ return d.id; }));
  DESIGNERS.splice(0, DESIGNERS.length, ...DESIGNERS.filter(function(d){ return d._fromJira; }));
  TICKETS.splice(0, TICKETS.length, ...TICKETS.filter(function(t){ return jiraDesignerIds.has(t.assignee); }));
  if (typeof PLANNING_TICKETS !== "undefined") PLANNING_TICKETS.length = 0;
  QUARTERS.forEach(function(q) {
    q.committed  = TICKETS.filter(function(t){ return t.quarter === q.id; }).length;
    q.scopeAdded = 0;
    q.delivered  = 0;
    q.dropped    = 0;
    q.spilled    = 0;
    if (Array.isArray(q.designerPerf)) q.designerPerf = q.designerPerf.filter(function(p){ return jiraDesignerIds.has(p.id); });
  });
  if (typeof WEEKLY !== "undefined") {
    ["planned","delivered","missed","carryForward","atRisk","nextWeek"].forEach(function(k) {
      if (Array.isArray(WEEKLY[k])) WEEKLY[k].length = 0;
    });
    WEEKLY.weekLabel = "";
  }
  rebuildWeeklyFromTickets();
  saveLiveData();
}

var _settingsStep        = 1;
var _allJiraFields       = [];
var _pendingFieldMap     = {};
var _pendingDesignerMap  = [];

// ── Storage helpers
function loadJiraConfig() {
  try {
    var s = sessionStorage.getItem(JIRA_CONFIG_KEY) || localStorage.getItem(JIRA_CONFIG_KEY) || "{}";
    return JSON.parse(s);
  } catch(e) { return {}; }
}
function saveJiraConfig(c) {
  var store = c.sessionOnly ? sessionStorage : localStorage;
  var other = c.sessionOnly ? localStorage  : sessionStorage;
  other.removeItem(JIRA_CONFIG_KEY);
  store.setItem(JIRA_CONFIG_KEY, JSON.stringify(c));
}
function loadFieldMap()      { try { return JSON.parse(localStorage.getItem(JIRA_FIELD_MAP_KEY)   || "{}");  } catch(e) { return {}; } }
function saveFieldMap(m)     { localStorage.setItem(JIRA_FIELD_MAP_KEY, JSON.stringify(m)); }
function loadDesignerMap()   { try { return JSON.parse(localStorage.getItem(JIRA_DESIGNER_MAP_KEY)|| "[]");  } catch(e) { return []; } }
function saveDesignerMap(m)  { localStorage.setItem(JIRA_DESIGNER_MAP_KEY, JSON.stringify(m)); }

// ── URL parsers, accept any pasted Jira URL
function parseJiraBaseUrl(raw) {
  raw = (raw || "").trim();
  try { var p = new URL(raw.startsWith("http") ? raw : "https://" + raw); return p.protocol + "//" + p.host; }
  catch(e) { return raw; }
}
function parseProjectKey(raw) {
  raw = (raw || "").trim();
  var m = raw.match(/\/projects\/([A-Z0-9_]+)/i);
  return m ? m[1].toUpperCase() : raw.toUpperCase().replace(/[^A-Z0-9_]/g, "");
}

// ── Proxy fetch (no CORS)
function jiraAuthHeader(cfg) { return "Basic " + btoa(cfg.email + ":" + cfg.token); }
// Always hit the local proxy on port 3333, regardless of where the page was opened from
// (works whether the tab is on http://localhost:3333 or opened directly as file://).
var PROXY_ORIGIN = (location.protocol === "http:" || location.protocol === "https:")
  ? location.origin
  : "http://localhost:3333";
function jiraFetch(cfg, path) {
  return fetch(PROXY_ORIGIN + "/jira-proxy", {
    headers: { "Authorization": jiraAuthHeader(cfg), "X-Jira-Url": cfg.url, "X-Jira-Path": path }
  });
}

// ── Sidebar status bar
function timeAgo(date) {
  var m = Math.round((Date.now() - date.getTime()) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + "m ago";
  var h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}
function refreshStatusBar() {
  var cfg  = loadJiraConfig();
  var last = localStorage.getItem(JIRA_LAST_SYNC_KEY);
  var dot  = document.getElementById("jira-status-dot");
  var lbl  = document.getElementById("jira-status-label");
  if (dot) {
    if (!cfg.token) {
      dot.style.background = "var(--border)"; lbl.textContent = "Jira not connected";
    } else if (last) {
      dot.style.background = "var(--green)"; lbl.textContent = "Synced " + timeAgo(new Date(last));
    } else {
      dot.style.background = "var(--amber)"; lbl.textContent = "Connected, tap ⚙ to sync";
    }
  }
  renderTopbarSprint();  // also refreshes the "Last synced" stamp in the topbar
}
function setStatusSyncing() {
  var dot = document.getElementById("jira-status-dot");
  var lbl = document.getElementById("jira-status-label");
  if (dot) { dot.style.background = "var(--amber)"; lbl.textContent = "Syncing…"; }
}

// ── Settings wizard, open / close
function openSettings() {
  document.getElementById("settings-modal").style.display = "flex";
  renderSettingsStep(1);
}
function closeSettings() {
  document.getElementById("settings-modal").style.display = "none";
  refreshStatusBar();
}
var _swMouseDownOnBackdrop = false;
document.addEventListener("mousedown", function(e) {
  var m = document.getElementById("settings-modal");
  _swMouseDownOnBackdrop = !!(m && e.target === m);
});
document.addEventListener("click", function(e) {
  var m = document.getElementById("settings-modal");
  if (m && e.target === m && _swMouseDownOnBackdrop) closeSettings();
  _swMouseDownOnBackdrop = false;
});

// ── Step renderer
function renderSettingsStep(step) {
  _settingsStep = step;
  // Step indicators
  ["sw-step-1","sw-step-2","sw-step-3"].forEach(function(id, i) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = "sw-step" + (i + 1 === step ? " active" : (i + 1 < step ? " done" : ""));
  });
  var content = document.getElementById("settings-step-content");
  var footer  = document.getElementById("settings-footer");
  if (step === 1) {
    content.innerHTML = renderStep1();
    footer.innerHTML  = btnBar("closeSettings()", "Cancel", "connectAndDiscover()", "Connect & Detect Fields →")
      + '<button onclick="handleClearDemoData()" style="position:absolute;left:20px;padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--red);font-size:11px;cursor:pointer" title="Wipe seed tickets, designers, and planning items, keeps only tickets from a live Jira sync">Clear all demo data</button>';
  } else if (step === 2) {
    content.innerHTML = renderStep2();
    footer.innerHTML  = btnBar("renderSettingsStep(1)", "← Back", "confirmFields()", "Confirm Fields →")
      + '<button onclick="clearJiraConfig()" style="position:absolute;left:20px;padding:7px 12px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--red);font-size:11px;cursor:pointer">Clear credentials</button>';
  } else if (step === 3) {
    content.innerHTML = renderStep3();
    footer.innerHTML  = btnBar("renderSettingsStep(2)", "← Back", "confirmDesignersAndSync()", "Save & Sync →");
  }
}
function btnBar(cancelFn, cancelLabel, okFn, okLabel) {
  return '<div style="display:flex;justify-content:flex-end;gap:8px;width:100%">'
    + '<button onclick="' + cancelFn + '" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--t2);font-size:12px;cursor:pointer">' + cancelLabel + '</button>'
    + '<button onclick="' + okFn + '" id="sw-ok-btn" style="padding:8px 18px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer">' + okLabel + '</button>'
    + '</div>';
}

// ── Step 1: Credentials
function renderStep1() {
  var cfg = loadJiraConfig();
  function fld(id, label, type, val, ph, hint) {
    var extra = type === "password"
      ? ' <button onclick="var i=document.getElementById(\''+id+'\');i.type=i.type===\'password\'?\'text\':\'password\'" style="border:none;background:none;color:var(--t3);cursor:pointer;font-size:11px;margin-left:4px">show/hide</button>' : "";
    return '<label style="display:flex;flex-direction:column;gap:4px;margin-bottom:12px">'
      + '<span style="font-size:11px;font-weight:600;color:var(--t2)">' + label + '</span>'
      + '<input id="' + id + '" type="' + type + '" value="' + (val||"").replace(/"/g,"&quot;") + '" placeholder="' + ph + '"'
      + ' style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--t1);font-size:12px;width:100%;box-sizing:border-box">'
      + '<span style="font-size:10px;color:var(--t3)">' + hint + extra + '</span></label>';
  }
  return '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:14px">Jira Connection</div>'
    + fld("cfg-url",   "Jira Instance URL", "text",     cfg.url||"",     "https://yourorg.atlassian.net", "Paste any Jira URL, we extract the base automatically")
    + fld("cfg-email", "Atlassian Email",   "email",    cfg.email||"",   "you@yourorg.com",               "The email you use to sign in to Jira")
    + fld("cfg-token", "API Token",         "password", cfg.token||"",   "Paste your API token",
        'Generate at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" style="color:var(--accent)">id.atlassian.com → API tokens</a>')
    + fld("cfg-proj",  "Jira Project Key",  "text",     cfg.project||"", "e.g. UX or paste board URL",   "The key prefix in your tickets, e.g. UX in UX-101")
    + '<label style="display:flex;align-items:flex-start;gap:8px;margin:6px 0 10px;cursor:pointer">'
    +   '<input id="cfg-session-only" type="checkbox" ' + (cfg.sessionOnly ? "checked" : "") + ' style="margin-top:2px">'
    +   '<span style="font-size:11px;color:var(--t2);line-height:1.4">Session only, clear my token when I close the browser<br>'
    +     '<span style="font-size:10px;color:var(--t3)">Safer on shared machines. You\'ll re-enter the token next time.</span></span>'
    + '</label>'
    + '<div id="sw-status" style="min-height:22px;font-size:11px"></div>';
}

// ── Step 1 → connect
function connectAndDiscover() {
  var cfg = {
    url:     parseJiraBaseUrl(document.getElementById("cfg-url").value),
    email:   (document.getElementById("cfg-email").value||"").trim(),
    token:   (document.getElementById("cfg-token").value||"").trim(),
    project: parseProjectKey(document.getElementById("cfg-proj").value),
    sessionOnly: document.getElementById("cfg-session-only").checked
  };
  var s = document.getElementById("sw-status");
  var btn = document.getElementById("sw-ok-btn");
  if (!cfg.url || !cfg.email || !cfg.token || !cfg.project) {
    s.innerHTML = '<span style="color:var(--amber)">⚠ All four fields are required.</span>'; return;
  }
  s.innerHTML = '<span style="color:var(--t3)">Testing connection…</span>';
  if (btn) btn.disabled = true;

  jiraFetch(cfg, "/rest/api/3/myself")
    .then(function(r){ return r.text().then(function(txt){ return { ok:r.ok, status:r.status, txt:txt }; }); })
    .then(function(res){
      if (res.txt.trim().startsWith("<")) {
        throw new Error("Jira returned an HTML page, this usually means the email or API token is incorrect. Double-check both and try again.");
      }
      var data; try { data = JSON.parse(res.txt); } catch(e) { throw new Error("Unexpected response from Jira: " + res.txt.slice(0,120)); }
      if (!res.ok) throw new Error("HTTP " + res.status + ", " + (data.message || (data.errorMessages||[]).join(", ") || "check your credentials"));
      return data;
    })
    .then(function(me) {
      s.innerHTML = '<span style="color:var(--green)">✓ Signed in as <strong>' + (me.displayName||cfg.email) + '</strong>, fetching fields…</span>';
      saveJiraConfig(cfg);
      return jiraFetch(cfg, "/rest/api/3/field");
    })
    .then(function(r){ return r.json(); })
    .then(function(fields) {
      _allJiraFields   = fields;
      _pendingFieldMap = autoDetectFields(fields);
      if (btn) btn.disabled = false;
      renderSettingsStep(2);
    })
    .catch(function(e) {
      s.innerHTML = '<span style="color:var(--red)">✗ ' + e.message + '</span>';
      if (btn) btn.disabled = false;
    });
}

// ── Field auto-detection
var FIELD_DEFS = [
  { key:"hiFiDate",        label:"Hi-Fi Committed Date",  req:true,  kw:["ux hi fi end","hi fi end","hi-fi end","hi-fi","hifi","hi fi","hi fi committed","committed hi"] },
  { key:"loFiDate",        label:"Lo-Fi Committed Date",  req:false, kw:["ux lo fi end","lo fi end","lo-fi end","lo-fi","lofi","lo fi","committed lo"] },
  { key:"finalReviewDate", label:"Final Review Committed Date", req:false, kw:["final review date","fr date","final review committed","lt review date","final review commitment"] },
  { key:"uxStartDate",     label:"UX Start Date",         req:false, kw:["ux start date","design start date","start date","commitment date"] },
  { key:"scope",           label:"Scope (IN / OUT / Maybe)", req:false, kw:["ux scope","scope[dropdown]","scope (dropdown)","design scope","commitment","scope"] },
  { key:"deliveryQuarter", label:"Delivery Quarter (PMO)", req:true, kw:["delivery quarter(pmo","delivery quarter (pmo","delivery quarter pmo","delivery quarter","quarter(pmo","quarter pmo","pmo only","quarter"] },
  { key:"size",            label:"T-Shirt Size (S/M/L)",  req:false, kw:["t-shirt","tshirt","t shirt","estimation size","ux size","effort size","size"] },
  { key:"aiUsage",         label:"AI Usage",              req:false, kw:["ai usage","ai tool","ai led","ai assisted"] },
  { key:"module",          label:"Module / Feature Area", req:false, kw:["module","feature area","product area"] },
  { key:"dateChanges",     label:"Date Change History",   req:false, kw:["date change","date drift","date moved"] },
];
function autoDetectFields(fields) {
  var map = {};
  FIELD_DEFS.forEach(function(def) {
    var best = null, score = 0;
    fields.forEach(function(f) {
      var name = (f.name||"").toLowerCase();
      def.kw.forEach(function(kw){ if (name.includes(kw) && kw.length > score){ score = kw.length; best = f; } });
    });
    map[def.key] = best ? best.id : null;
  });
  return map;
}

// ── Step 2: Field mapping
function renderStep2() {
  var saved = loadFieldMap();
  var customFields = _allJiraFields.filter(function(f){ return f.custom; });
  var baseOpts = '<option value="">,  skip , </option>'
    + customFields.map(function(f){ return '<option value="' + f.id + '">' + f.name + ' (' + f.id + ')</option>'; }).join("");

  var rows = FIELD_DEFS.map(function(def) {
    var current  = _pendingFieldMap[def.key] || saved[def.key] || "";
    var detected = !!_pendingFieldMap[def.key];
    var badge    = detected
      ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(99,102,241,.12);color:var(--accent);margin-left:4px">auto-detected</span>'
      : (def.req ? '<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(239,68,68,.10);color:var(--red);margin-left:4px">not found</span>' : "");
    var opts = baseOpts.replace('value="' + current + '"', 'value="' + current + '" selected');
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bg)">'
      + '<div style="flex:1;font-size:11px;font-weight:600;color:var(--t1)">' + def.label + badge + '</div>'
      + '<select id="fm-' + def.key + '" style="padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--t1);font-size:11px;min-width:220px">' + opts + '</select>'
      + '</div>';
  }).join("");

  return '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:8px">Field Mapping</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px">We auto-detected your Jira custom fields. Adjust any mismatches or skip fields you don\'t use.</div>'
    + rows;
}

// ── Step 2 confirm → fetch assignees → step 3
function confirmFields() {
  var map = {};
  FIELD_DEFS.forEach(function(def){ var el = document.getElementById("fm-" + def.key); map[def.key] = el ? (el.value||null) : null; });
  _pendingFieldMap = map;
  saveFieldMap(map);

  var cfg = loadJiraConfig();
  document.getElementById("settings-step-content").innerHTML =
    '<div style="text-align:center;padding:32px;color:var(--t3);font-size:12px">Fetching team members from Jira…</div>';

  var jql = 'project = "' + cfg.project + '" AND type IN (Feature, Pattern, Research, Revamp, "UX Signoff") ORDER BY created DESC';
  jiraFetch(cfg, "/rest/api/3/search/jql?jql=" + encodeURIComponent(jql) + "&maxResults=100&fields=assignee")
    .then(function(r){ return r.json(); })
    .then(function(data) {
      var seen = {};
      (data.issues||[]).forEach(function(i){
        var a = i.fields && i.fields.assignee;
        if (a && a.accountId && !seen[a.accountId])
          seen[a.accountId] = { accountId: a.accountId, name: a.displayName||"", email: a.emailAddress||"" };
      });
      _pendingDesignerMap = Object.keys(seen).map(function(k){ return seen[k]; });
      renderSettingsStep(3);
    })
    .catch(function(){ _pendingDesignerMap = []; renderSettingsStep(3); });
}

// ── Step 3: Which Jira users are designers on your team?
function renderStep3() {
  var saved = loadDesignerMap();
  // A user is "on the team" if they were previously saved as a designer (has a dashboardId)
  function isSelected(accountId) {
    var s = saved.find(function(x){ return x.jiraAccountId === accountId; });
    return s ? !!s.dashboardId : true;  // default: everyone on first run
  }
  var podOptions = '<option value="pod-a">Pod A</option><option value="pod-b">Pod B</option>';

  if (!_pendingDesignerMap.length) {
    return '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:8px">Your Design Team</div>'
      + '<div style="font-size:11px;color:var(--t3)">No assignees found in this project. Tickets will sync as unassigned. You can re-map later.</div>';
  }

  var rows = _pendingDesignerMap.map(function(ju) {
    var savedRow = saved.find(function(s){ return s.jiraAccountId === ju.accountId; });
    var checked  = isSelected(ju.accountId);
    var pod      = savedRow && savedRow.pod ? savedRow.pod : "pod-a";
    var cbId     = "dm-cb-" + ju.accountId.replace(/[^a-z0-9]/gi, "");
    var podId    = "dm-pod-" + ju.accountId.replace(/[^a-z0-9]/gi, "");
    var opts     = podOptions.replace('value="' + pod + '"', 'value="' + pod + '" selected');
    return '<label for="' + cbId + '" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--bg);cursor:pointer">'
      + '<input id="' + cbId + '" type="checkbox" data-account="' + ju.accountId + '" data-name="' + ju.name.replace(/"/g,"&quot;") + '" ' + (checked?"checked":"") + ' style="width:16px;height:16px;cursor:pointer">'
      + '<div style="width:28px;height:28px;border-radius:50%;background:var(--accent);font-size:10px;font-weight:700;color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials(ju.name) + '</div>'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12px;font-weight:600;color:var(--t1)">' + ju.name + '</div>'
      +   '<div style="font-size:10px;color:var(--t3)">' + (ju.email||", ") + '</div>'
      + '</div>'
      + '<select id="' + podId + '" onclick="event.preventDefault();event.stopPropagation()" style="padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--t1);font-size:11px">' + opts + '</select>'
      + '</label>';
  }).join("");

  return '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--t3);margin-bottom:8px">Your Design Team</div>'
    + '<div style="font-size:11px;color:var(--t3);margin-bottom:12px">Check the Jira users who are designers on your team. Their real names will replace the demo designers. Uncheck anyone from other departments.</div>'
    + '<div style="display:flex;gap:8px;margin-bottom:10px">'
    +   '<button onclick="dmToggleAll(true)" style="padding:4px 10px;font-size:10px;border:1px solid var(--border);border-radius:4px;background:var(--surface-2);color:var(--t2);cursor:pointer">Select all</button>'
    +   '<button onclick="dmToggleAll(false)" style="padding:4px 10px;font-size:10px;border:1px solid var(--border);border-radius:4px;background:var(--surface-2);color:var(--t2);cursor:pointer">Deselect all</button>'
    + '</div>'
    + rows;
}
function dmToggleAll(state) {
  document.querySelectorAll('#settings-step-content input[type="checkbox"][data-account]').forEach(function(cb){ cb.checked = state; });
}

// ── Step 3 confirm → replace designer roster with real Jira users → full sync
function confirmDesignersAndSync() {
  var palette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7"];
  var dMap = [], newDesigners = [], idx = 0;
  document.querySelectorAll('#settings-step-content input[type="checkbox"][data-account]').forEach(function(cb) {
    var accountId = cb.dataset.account;
    var name      = cb.dataset.name;
    var podSel    = document.getElementById("dm-pod-" + accountId.replace(/[^a-z0-9]/gi, ""));
    var pod       = podSel ? podSel.value : "pod-a";
    if (!cb.checked) {
      dMap.push({ jiraAccountId: accountId, jiraName: name, dashboardId: "", excluded: true });
      return;
    }
    var id = "jira-" + accountId.replace(/[^a-z0-9]/gi, "").slice(0, 20).toLowerCase();
    newDesigners.push({
      id: id, name: name, pod: pod,
      initials: initials(name).slice(0, 2),
      color: palette[idx % palette.length],
      _jiraAccountId: accountId,
      _fromJira: true
    });
    dMap.push({ jiraAccountId: accountId, jiraName: name, dashboardId: id, pod: pod });
    idx++;
  });
  // Replace the roster wholesale, dummy Priya/Arjun/Rahul/Sneha are gone.
  DESIGNERS.length = 0;
  Array.prototype.push.apply(DESIGNERS, newDesigners);
  // Wipe all seed tickets, the historical demo data references dummy designers that no longer exist.
  // The upcoming Jira sync will repopulate TICKETS from live data.
  TICKETS.length = 0;
  saveDesignerMap(dMap);
  document.getElementById("settings-step-content").innerHTML =
    '<div style="text-align:center;padding:40px"><div style="font-size:13px;font-weight:600;color:var(--t1);margin-bottom:8px">Syncing from Jira…</div>'
    + '<div style="font-size:11px;color:var(--t3)" id="sync-progress-msg">Fetching tickets…</div></div>';
  document.getElementById("settings-footer").innerHTML = "";

  runFullSync(function(count, err, report) {
    if (err) {
      document.getElementById("settings-step-content").innerHTML =
        '<div style="text-align:center;padding:32px">'
        + '<div style="font-size:13px;font-weight:600;color:var(--red);margin-bottom:10px">Sync could not update dashboard</div>'
        + '<div style="font-size:11px;color:var(--t3);white-space:pre-wrap;text-align:left;background:var(--surface-2);padding:12px;border-radius:6px">' + err + '</div></div>';
      document.getElementById("settings-footer").innerHTML = btnBar("renderSettingsStep(3)", "← Back", "closeSettings()", "Close");
      return;
    }
    var qLines = Object.keys(report.byQuarter || {}).map(function(qid) {
      var q = QUARTERS.find(function(x){ return x.id === qid; });
      var raw = (report.rawByQuarter || {})[qid] || {};
      var rawKeys = Object.keys(raw);
      // Only show the raw-value breakdown when there's more than one distinct wording, // that's the signal something other than the exact PMO tag is being swept in.
      var rawLine = rawKeys.length > 1
        ? '<div style="margin:2px 0 6px;padding-left:8px;border-left:2px solid var(--border)">'
          + rawKeys.map(function(k){ return '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--t3)"><span>"' + k + '"</span><span>' + raw[k] + '</span></div>'; }).join("")
          + '</div>'
        : '';
      return '<div style="padding:3px 0">'
        + '<div style="display:flex;justify-content:space-between"><span style="color:var(--t2)">' + (q ? q.sprintName : qid) + '</span><span style="font-weight:700;color:var(--t1)">' + report.byQuarter[qid] + '</span></div>'
        + rawLine
        + '</div>';
    }).join("") || '<div style="color:var(--t3);text-align:center">, </div>';

    document.getElementById("settings-step-content").innerHTML =
      '<div style="padding:20px 8px">'
      + '<div style="text-align:center;margin-bottom:20px">'
      +   '<div style="font-size:32px;margin-bottom:6px">✓</div>'
      +   '<div style="font-size:15px;font-weight:700;color:var(--green)">Synced ' + count + ' tickets</div>'
      +   '<div style="font-size:11px;color:var(--t3);margin-top:4px">Dashboard is now powered by live Jira data.</div>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">'
      +   '<div style="background:var(--surface-2);border-radius:6px;padding:10px 12px"><div style="font-size:10px;color:var(--t3);text-transform:uppercase;font-weight:700;letter-spacing:.06em">Fetched</div><div style="font-size:18px;font-weight:700;color:var(--t1);margin-top:2px">' + report.fetched + '</div></div>'
      +   '<div style="background:var(--surface-2);border-radius:6px;padding:10px 12px"><div style="font-size:10px;color:var(--t3);text-transform:uppercase;font-weight:700;letter-spacing:.06em">Kept</div><div style="font-size:18px;font-weight:700;color:var(--green);margin-top:2px">' + report.kept + '</div></div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--t3);text-transform:uppercase;font-weight:700;letter-spacing:.06em;margin-bottom:6px">Dropped by filter</div>'
      + '<div style="background:var(--surface-2);border-radius:6px;padding:10px 12px;margin-bottom:14px;font-size:11px;color:var(--t2)">'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0">Not from project prefix<span style="font-weight:700">' + (report.droppedProject || 0) + '</span></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0">Out of scope (OUT / Maybe)<span style="font-weight:700">' + report.droppedScope + '</span></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0">Assignee not a mapped designer<span style="font-weight:700">' + report.droppedAssignee + '</span></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0">Cancelled / Duplicate<span style="font-weight:700">' + report.droppedTerminal + '</span></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0">No / unknown Delivery Quarter<span style="font-weight:700">' + (report.droppedQuarter || 0) + '</span></div>'
      + '</div>'
      + '<div style="font-size:10px;color:var(--t3);text-transform:uppercase;font-weight:700;letter-spacing:.06em;margin-bottom:6px">By quarter</div>'
      + '<div style="background:var(--surface-2);border-radius:6px;padding:10px 12px;font-size:11px">' + qLines + '</div>'
      + '</div>';
    document.getElementById("settings-footer").innerHTML =
      '<div style="display:flex;justify-content:flex-end;width:100%"><button onclick="closeSettings()" style="padding:8px 22px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer">Done ✓</button></div>';
    navigate(currentPage, false);
  });
}

// ── Confirm + run the wipe from the wizard, then rerender everything
function handleClearDemoData() {
  if (!confirm("This will remove every demo/seed ticket, designer, and planning item. Only tickets from live Jira syncs will remain. Continue?")) return;
  clearAllDemoData();
  navigate(currentPage, false);
  closeSettings();
}

// ── Clear credentials + wipe cached live data
function clearJiraConfig() {
  [JIRA_CONFIG_KEY, JIRA_FIELD_MAP_KEY, JIRA_DESIGNER_MAP_KEY, JIRA_LAST_SYNC_KEY, JIRA_LIVE_DATA_KEY].forEach(function(k){
    localStorage.removeItem(k);
    sessionStorage.removeItem(k);
  });
  renderSettingsStep(1);
}

// ── Core sync engine, used by wizard and auto-refresh
function runFullSync(callback) {
  var cfg      = loadJiraConfig();
  var fieldMap = loadFieldMap();
  var dMap     = loadDesignerMap();
  if (!cfg.url || !cfg.email || !cfg.token || !cfg.project) {
    if (callback) callback(0, "Jira not configured, open Settings to connect"); return;
  }
  setStatusSyncing();

  // Build field list for API request
  var fields = ["summary","status","assignee","issuetype","created","updated"];
  Object.values(fieldMap).forEach(function(fid){ if (fid && !fields.includes(fid)) fields.push(fid); });

  // Broad query, bring in every issue in the project. Type/scope filtering happens
  // in mapJiraIssue based on the field map (so the user isn't blocked by naming mismatches).
  // expand=changelog pulls per-issue history so we can show date/scope/size changes and
  // who made them, falls back gracefully (empty history) if the endpoint ignores it.
  var jql       = 'project = "' + cfg.project + '" ORDER BY updated DESC';
  var pageSize  = 100;                    // Jira's new /search/jql cap per page
  var basePath  = "/rest/api/3/search/jql?jql=" + encodeURIComponent(jql)
                + "&maxResults=" + pageSize + "&fields=" + fields.join(",")
                + "&expand=changelog";
  var allIssues = [];
  var pages     = 0;

  function progress(msg) {
    var el = document.getElementById("sync-progress-msg");
    if (el) el.textContent = msg;
  }

  function fetchPage(nextToken) {
    var path = basePath + (nextToken ? "&nextPageToken=" + encodeURIComponent(nextToken) : "");
    return jiraFetch(cfg, path)
      .then(function(r){ return r.text().then(function(txt){ return { ok:r.ok, status:r.status, txt:txt }; }); })
      .then(function(res){
        if (res.txt.trim().startsWith("<")) throw new Error("Jira returned an HTML page, check your credentials.");
        var data; try { data = JSON.parse(res.txt); } catch(e) { throw new Error("Unexpected response: " + res.txt.slice(0,120)); }
        if (!res.ok) throw new Error("HTTP " + res.status + ": " + (data.errorMessages||[data.message||"unknown"]).join(", "));
        var batch = data.issues || [];
        Array.prototype.push.apply(allIssues, batch);
        pages++;
        progress("Fetched " + allIssues.length + " tickets…");
        if (data.nextPageToken && batch.length > 0 && pages < 50) {  // 50-page safety cap = 5000 tickets max
          return fetchPage(data.nextPageToken);
        }
      });
  }

  fetchPage(null)
    .then(function() {
      // De-dupe by issue key. The query pages through /search/jql sorted by "updated DESC", // on an active board, any ticket updated WHILE a multi-page sync is running can shift
      // position between pages and get returned twice (a known Jira cursor-pagination
      // pitfall). Left unguarded, this silently inflates every count downstream, exactly
      // the kind of "Jira says 74, dashboard says 84" mismatch a small handful of
      // in-flight updates during sync would produce.
      var seenKeys = new Set();
      allIssues = allIssues.filter(function(i){
        if (seenKeys.has(i.key)) return false;
        seenKeys.add(i.key);
        return true;
      });
      var rawIssueCount = allIssues.length;
      var projectPrefix = (cfg.project || "").toUpperCase() + "-";
      var allMapped     = allIssues.map(function(i){ return mapJiraIssue(i, fieldMap, dMap); });

      // Strict project-key filter, only the user's project prefix (e.g. "UX-") counts.
      var afterProject = allMapped.filter(function(t){ return t.key && t.key.toUpperCase().indexOf(projectPrefix) === 0; });
      var afterScope   = afterProject.filter(function(t){ return t.scope !== "OUT"; });
      var afterAssign  = afterScope.filter(function(t){ return t.assignee != null; });
      var afterStatus  = afterAssign.filter(function(t){ return t.status !== "Cancelled" && t.status !== "Duplicate"; });
      // Strict quarter filter, only tickets with a Delivery Quarter (PMO Only) value
      // that matches a known dashboard quarter. Unquartered / unrecognised → dropped.
      var mapped       = afterStatus.filter(function(t){ return t.quarter != null; });

      // SAFETY: if every ticket was filtered out, keep existing data and surface a report
      // instead of blanking the dashboard right before a demo.
      if (rawIssueCount > 0 && mapped.length === 0) {
        var scopeDroppedCount = afterProject.length - afterScope.length;
        var scopeSample = "";
        if (scopeDroppedCount > 0) {
          // Show what the Scope field's raw values actually look like, the #1 cause of
          // this failure is the mapped field using wording the filter doesn't recognise.
          var seen = [];
          afterProject.forEach(function(t){
            if (t.scope === "OUT" && t._scopeRaw != null && seen.indexOf(t._scopeRaw) === -1) seen.push(t._scopeRaw);
          });
          if (seen.length) scopeSample = " (sample raw values: " + seen.slice(0,5).map(function(v){ return '"' + v + '"'; }).join(", ") + ")";
        }
        var msg = "Sync returned " + rawIssueCount + " tickets but 0 survived filters.\n"
          + "• Not from " + cfg.project + " project: " + (allMapped.length - afterProject.length) + "\n"
          + "• Dropped by scope filter (OUT/Maybe): " + scopeDroppedCount + scopeSample + "\n"
          + "• Assignee not a mapped designer: " + (afterScope.length - afterAssign.length) + "\n"
          + "• Cancelled / Duplicate: " + (afterAssign.length - afterStatus.length) + "\n"
          + "• No / unknown Delivery Quarter: " + (afterStatus.length - mapped.length) + "\n\n"
          + "Existing data was kept, check field mappings and try again.";
        if (callback) callback(0, msg);
        return;
      }

      // Replace every quarter that Jira returned data for (not just active),
      // so JAS 26 gets JAS 26 tickets and OND 26 gets OND 26 tickets, no cross-contamination.
      var touchedQuarters = new Set(mapped.map(function(t){ return t.quarter; }));
      var kept = TICKETS.filter(function(t){ return !touchedQuarters.has(t.quarter); });
      TICKETS.length = 0;
      Array.prototype.push.apply(TICKETS, kept.concat(mapped));
      touchedQuarters.forEach(function(qid) {
        var q = QUARTERS.find(function(x){ return x.id === qid; });
        if (q) q.committed = mapped.filter(function(t){ return t.quarter === qid; }).length;
      });
      purgeUnusedDemoDesigners();
      purgeUnusedDemoModules();
      // Wipe demo planning-quarter tickets, real Jira data supersedes them.
      if (typeof PLANNING_TICKETS !== "undefined" && Array.isArray(PLANNING_TICKETS)) PLANNING_TICKETS.length = 0;
      rebuildWeeklyFromTickets();
      saveLiveData();
      localStorage.setItem(JIRA_LAST_SYNC_KEY, new Date().toISOString());
      refreshStatusBar();

      // Build a per-quarter/per-designer sync summary the caller can display.
      var byQuarter = {};
      mapped.forEach(function(t){ byQuarter[t.quarter] = (byQuarter[t.quarter]||0) + 1; });
      // Raw PMO field values that landed in each quarter, lets you check, next time a
      // count looks off, whether some unexpected wording (e.g. "OND 26 - Carryover") is
      // being swept into a quarter alongside the exact value Jira's own filter matches on.
      var rawByQuarter = {};
      mapped.forEach(function(t){
        if (!t.quarter) return;
        rawByQuarter[t.quarter] = rawByQuarter[t.quarter] || {};
        var raw = t._rawQuarter == null ? "(blank)" : String(t._rawQuarter);
        rawByQuarter[t.quarter][raw] = (rawByQuarter[t.quarter][raw] || 0) + 1;
      });
      var report = {
        fetched:    rawIssueCount,
        dropped:    rawIssueCount - mapped.length,
        droppedProject:  allMapped.length   - afterProject.length,
        droppedScope:    afterProject.length - afterScope.length,
        droppedAssignee: afterScope.length   - afterAssign.length,
        droppedTerminal: afterAssign.length  - afterStatus.length,
        droppedQuarter:  afterStatus.length  - mapped.length,
        kept:       mapped.length,
        byQuarter:  byQuarter,
        rawByQuarter: rawByQuarter,
        designers:  DESIGNERS.length
      };
      if (callback) callback(mapped.length, null, report);
    })
    .catch(function(e) {
      refreshStatusBar();
      if (callback) callback(0, e.message);
    });
}

// Strictly match a Jira delivery-quarter value to a dashboard quarter id.
// Requires BOTH the season shorthand (JFM/AMJ/JAS/OND) AND the year to match.
// Returns null if the value doesn't clearly identify one quarter, that ticket is
// then dropped by runFullSync (surfaced in the sync report), never guessed.
function resolveQuarterFromJira(raw) {
  if (!raw) return null;
  var s = String(raw).toUpperCase();
  var seasonMatch = s.match(/\b(JFM|AMJ|JAS|OND)\b/) || s.match(/(JFM|AMJ|JAS|OND)/);
  var yearNums    = s.match(/\d{2,4}/g) || [];
  var year = null;
  if (yearNums.length) {
    var y = yearNums[yearNums.length - 1];       // pick the last number in the string
    year = (y.length === 2) ? "20" + y : y;
  }

  // Preferred path, season + year must both match a quarter's own season+year.
  if (seasonMatch && year) {
    var hit = QUARTERS.find(function(q) {
      var qSeason = (q.sprintName || "").toUpperCase().match(/(JFM|AMJ|JAS|OND)/);
      var qYear   = String(q.label || "").match(/(\d{4})/);
      return qSeason && qSeason[1] === seasonMatch[1] && qYear && qYear[1] === year;
    });
    if (hit) return hit.id;
    return null;  // named a season+year the dashboard doesn't know, drop
  }

  // No season shorthand? Fall back to exact match on the quarter's normalised sprintName/label/id.
  var norm = s.replace(/[^A-Z0-9]/g, "");
  for (var i = 0; i < QUARTERS.length; i++) {
    var q = QUARTERS[i];
    var candidates = [q.sprintName, q.label, q.id];
    for (var j = 0; j < candidates.length; j++) {
      var c = String(candidates[j] || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (c && norm === c) return q.id;
    }
  }
  return null;
}

// Resolve a Jira assignee to a dashboard designer id.
// Rules:
//   1. Explicit "keep" in dMap (dashboardId set) → use that id.
//   2. Explicit "exclude" in dMap (dashboardId === "" AND excluded===true) → drop the ticket.
//   3. Not in the map at all → auto-create a designer so tickets are never lost.
var _designerPalette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7"];
function ensureDesignerFor(jiraAssignee, dMap) {
  if (!jiraAssignee || !jiraAssignee.accountId) return null;
  var entry = (dMap || []).find(function(d){ return d.jiraAccountId === jiraAssignee.accountId; });
  if (entry && entry.excluded) return null;
  if (entry && entry.dashboardId) return entry.dashboardId;

  var existing = DESIGNERS.find(function(d){ return d._jiraAccountId === jiraAssignee.accountId; });
  if (existing) return existing.id;

  var name = jiraAssignee.displayName || jiraAssignee.emailAddress || "Unknown";
  var id   = "jira-" + jiraAssignee.accountId.replace(/[^a-z0-9]/gi, "").slice(0, 20).toLowerCase();
  DESIGNERS.push({
    id: id, name: name, pod: (entry && entry.pod) || "pod-a",
    initials: initials(name).slice(0, 2),
    color: _designerPalette[DESIGNERS.length % _designerPalette.length],
    _jiraAccountId: jiraAssignee.accountId,
    _fromJira: true
  });
  return id;
}

// Remove seed/demo designers that have no live tickets after a Jira sync.
function purgeUnusedDemoDesigners() {
  var used = new Set(TICKETS.map(function(t){ return t.assignee; }).filter(Boolean));
  for (var i = DESIGNERS.length - 1; i >= 0; i--) {
    var d = DESIGNERS[i];
    if (!d._fromJira && !used.has(d.id)) DESIGNERS.splice(i, 1);
  }
}

// Same for seed/demo modules (Hire, Core Platform, etc.), once real Jira modules exist,
// the fictional seed ones shouldn't keep showing up as empty columns.
function purgeUnusedDemoModules() {
  var used = new Set(TICKETS.map(function(t){ return t.module; }).filter(Boolean));
  for (var i = MODULES.length - 1; i >= 0; i--) {
    var m = MODULES[i];
    if (!m._fromJira && !used.has(m.id)) MODULES.splice(i, 1);
  }
}

// ── Issue mapper, uses dynamic field map + designer map
// Parses a Jira issue's changelog (issue.changelog.histories) into a normalized
// change history: who changed what field, from what, to what, and when.
// Safe against missing changelog (bulk search may or may not include it), returns
// all-empty results rather than throwing, so callers never need to null-check deeply.
function extractChangeHistory(issue, fieldMap) {
  var histories = (issue.changelog && issue.changelog.histories) || [];
  var hiFiId  = fieldMap.hiFiDate, loFiId = fieldMap.loFiDate, scopeId = fieldMap.scope;
  var out = { changeHistory: [], dateChanges: [], scopeChanges: [], sizeChanges: [], lastChangedBy: null };

  histories.forEach(function(h) {
    var author = (h.author && h.author.displayName) || "Unknown";
    var when   = h.created ? h.created.slice(0, 10) : null;
    (h.items || []).forEach(function(item) {
      var fid   = item.fieldId || item.field || "";
      var fname = String(item.field || "").toLowerCase();
      var kind = null;
      if (fid === hiFiId || fname.indexOf("hi-fi") > -1 || fname.indexOf("hi fi") > -1 || fname === "duedate") kind = "date";
      else if (fid === loFiId || fname.indexOf("lo-fi") > -1 || fname.indexOf("lo fi") > -1) kind = "date";
      else if (fid === scopeId || fname.indexOf("scope") > -1) kind = "scope";
      else if (fname.indexOf("size") > -1 || fname.indexOf("t-shirt") > -1 || fname.indexOf("estimation") > -1) kind = "size";
      if (!kind || !when) return;

      var rec = { date: when, by: author, field: item.field || fid, from: item.fromString || item.from || ", ", to: item.toString || item.to || ", ", kind: kind };
      out.changeHistory.push(rec);
      if (kind === "date")  out.dateChanges.push(when);
      if (kind === "scope") out.scopeChanges.push(rec);
      if (kind === "size")  out.sizeChanges.push(rec);
    });
  });

  out.changeHistory.sort(function(a, b){ return b.date.localeCompare(a.date); });
  if (out.changeHistory.length) out.lastChangedBy = out.changeHistory[0].by;
  return out;
}

// Derives when a ticket most recently entered a review-adjacent final stage
// (Final Review / Pan PM Review / LT Review), from the same changelog data, // no separate Jira field needed. Returns null if it never reached that stage.
function deriveFinalReviewDate(changeHistory, histories) {
  var finalStatusNames = ["final review", "pan pm's review", "pan pms review", "pan pm review", "lt review"];
  var hits = (histories || []).flatMap(function(h) {
    var when = h.created ? h.created.slice(0, 10) : null;
    return (h.items || [])
      .filter(function(item){ return String(item.field || "").toLowerCase() === "status" && finalStatusNames.indexOf(String(item.toString || "").toLowerCase()) > -1; })
      .map(function(){ return when; });
  }).filter(Boolean);
  return hits.length ? hits.sort().pop() : null;
}

// Resolves a Jira module/feature-area value to a dashboard module id, auto-creating one
// from the real Jira value if it doesn't match anything seen before, exactly like
// ensureDesignerFor() does for assignees. The old approach fuzzy-matched against a fixed,
// made-up MODULES list from the seed data, so any real Jira taxonomy that didn't happen to
// resemble "Hire" / "Core Platform" / etc. silently resolved to nothing. Now the module list
// IS whatever your Jira actually tags tickets with.
var _modulePalette = ["#6366f1","#8b5cf6","#ec4899","#f59e0b","#10b981","#3b82f6","#ef4444","#14b8a6","#f97316","#a855f7"];
// Fields that resolve to "Yes"/"No"/"True"/"False" are almost always a mismapped checkbox
// field, not a real module/feature-area tag, treat them as unmapped rather than creating a
// nonsense "No" column that swallows every ticket.
var _BOOLEAN_LIKE = ["yes","no","true","false","y","n"];
function ensureModuleFor(rawValue) {
  if (!rawValue) return null;
  var norm = String(rawValue).toLowerCase().trim();
  if (_BOOLEAN_LIKE.indexOf(norm) !== -1) return null;
  var existing = MODULES.find(function(m){ return m._jiraRaw && m._jiraRaw.toLowerCase().trim() === norm; });
  if (existing) return existing.id;
  var id = "jira-mod-" + norm.replace(/[^a-z0-9]+/g, "-").slice(0, 30);
  MODULES.push({
    id: id, name: String(rawValue).trim(), pod: "pod-a",
    color: _modulePalette[MODULES.length % _modulePalette.length],
    icon: "◆", _jiraRaw: rawValue, _fromJira: true,
  });
  return id;
}

function mapJiraIssue(issue, fieldMap, dMap) {
  var f = issue.fields || {};
  var changeInfo = extractChangeHistory(issue, fieldMap);
  // Prefer a real committed Final Review field if the user mapped one; only fall back to
  // the derived "entered this stage" timestamp for display, never for deadline-missed checks.
  var mappedFinalReview   = fmtDate(cf(fieldMap.finalReviewDate));
  var finalReviewIsCommitted = !!mappedFinalReview;
  var finalReviewDate = mappedFinalReview || deriveFinalReviewDate(changeInfo.changeHistory, (issue.changelog && issue.changelog.histories) || []);

  // UX Start Date, when work actually became committed, NOT when the Jira ticket was
  // created (tickets often sit uncommitted/out-of-scope for months before real work
  // begins). Priority: a real mapped Jira field > the most recent time scope flipped to
  // IN > the earliest committed-date change > ticket creation, as a last resort.
  var uxStartDate = fmtDate(cf(fieldMap.uxStartDate));
  if (!uxStartDate) {
    var scopeInDates = changeInfo.scopeChanges
      .filter(function(c){ return String(c.to).toUpperCase() === "IN"; })
      .map(function(c){ return c.date; });
    if (scopeInDates.length) uxStartDate = scopeInDates.sort().pop();
  }
  if (!uxStartDate) {
    var dateChangeEvents = changeInfo.changeHistory.filter(function(c){ return c.kind === "date"; }).map(function(c){ return c.date; });
    if (dateChangeEvents.length) uxStartDate = dateChangeEvents.slice().sort()[0];
  }
  if (!uxStartDate) uxStartDate = fmtDate(f.created);

  // Status map covers all 5 UX workflows: Feature/UX Revamp/Pattern, UX Signoff,
  // UX Research, UX Signoff Review, plus legacy names.
  // Keys are normalised (lowercase, spaces collapsed) so "UX Done", "ux done", "UX  Done" all match.
  var STATUS_MAP = {
    //. To Do bucket, "todo":"To Do","to do":"To Do","open":"To Do","backlog":"To Do","selected for development":"To Do",
    //, In Progress: design phases, "req gathering":"In Progress","requirement gathering":"In Progress",
    "user research":"In Progress","research":"In Progress","research in progress":"In Progress",
    "lo fi design":"In Progress","lo-fi design":"In Progress","lo fi":"In Progress","lo-fi":"In Progress","lofi":"In Progress",
    "hi fi design":"In Progress","hi-fi design":"In Progress","hi fi":"In Progress","hi-fi":"In Progress","hifi":"In Progress",
    "content design":"In Progress","ux in progress":"In Progress","in progress":"In Progress",
    "review 1 observation":"In Progress","review 2 observation":"In Progress","iteration":"In Progress",
    //, In Review, "research review":"In Review","pod review":"In Review",
    "final review":"In Review","pan pm's review":"In Review","pan pms review":"In Review","pan pm review":"In Review",
    "lt review":"In Review","in review":"In Review",
    "review 1":"In Review","review 2":"In Review",
    //. Done, "ux done":"Done","research done":"Done","done":"Done","closed":"Done","resolved":"Done",
    //. Cancelled / duplicate / won't do (terminal, NOT delivered), "cancel":"Cancelled","cancelled":"Cancelled","canceled":"Cancelled",
    "won't do":"Cancelled","wont do":"Cancelled","wontdo":"Cancelled",
    "rejected":"Cancelled","invalid":"Cancelled","obsolete":"Cancelled","descoped":"Cancelled",
    "duplicate":"Duplicate"
  };
  // Folds all workflow stages from every issue type (Feature/UX Revamp/Pattern, UX Signoff,
  // UX Research, UX Signoff Review) into the same 10 Kanban columns as the real Jira board.
  var STAGE_MAP = {
    "todo":"TO DO","to do":"TO DO","open":"TO DO","backlog":"TO DO",
    "req gathering":"TO DO","requirement gathering":"TO DO",
    "user research":"RESEARCH","research":"RESEARCH","research in progress":"RESEARCH",
    "research review":"RESEARCH",
    "review 1":"LO-FI","review 1 observation":"LO-FI",
    "lo fi design":"LO-FI","lo-fi design":"LO-FI","lo fi":"LO-FI","lo-fi":"LO-FI","lofi":"LO-FI",
    "review 2":"HI-FI","review 2 observation":"HI-FI",
    "hi fi design":"HI-FI","hi-fi design":"HI-FI","hi fi":"HI-FI","hi-fi":"HI-FI","hifi":"HI-FI",
    "content design":"CONTENT DESIGN","ux in progress":"UX IN PROGRESS",
    "pod review":"POD REVIEW",
    "iteration":"ITERATION",
    "final review":"LT REVIEW","lt review":"LT REVIEW",
    "pan pm's review":"LT REVIEW","pan pms review":"LT REVIEW","pan pm review":"LT REVIEW",
    "done":"Done","ux done":"Done","research done":"Done","closed":"Done","resolved":"Done",
    "cancel":"Cancelled","cancelled":"Cancelled","canceled":"Cancelled","duplicate":"Duplicate"
  };
  function _norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  var rawStatus = f.status ? f.status.name : "To Do";
  var key       = _norm(rawStatus);
  var status    = STATUS_MAP[key] || "In Progress";
  var stage     = STAGE_MAP[key]  || null;

  // Resolve assignee, explicit mapping wins, else auto-create a dashboard designer
  var assigneeId = ensureDesignerFor(f.assignee, dMap);

  // Get a custom field value, handles string, object {value}, array
  function cf(fieldId) {
    if (!fieldId) return null;
    var v = f[fieldId];
    if (!v && v !== 0) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.length ? (v[0].value || v[0].name || String(v[0])) : null;
    return v.value || v.name || String(v);
  }
  function fmtDate(d) { return d ? String(d).slice(0,10) : null; }

  // Scope
  // Scope: only explicit Out/Maybe values are excluded, everything else (a clear "In",
  // or any value we don't recognise) counts as IN. An unrecognised value used to default
  // to OUT, which meant a Scope field using different wording than expected (e.g.
  // "Confirmed", "Locked") silently dropped every single ticket. Defaulting unknowns to
  // IN keeps the "ignore Maybe and Out" intent while never wiping the whole sync over a
  // vocabulary mismatch.
  // If the Scope field is NOT mapped, don't filter at all.
  function _isOutOrMaybe(v) {
    if (v == null) return false;
    var s = String(v).toUpperCase().trim();
    if (s === "" ) return false;
    var out = ["OUT", "OUT-SCOPE", "OUT SCOPE", "OUT OF SCOPE", "OUTSCOPE", "NO", "FALSE", "EXCLUDED", "DESCOPED", "DROPPED"];
    var maybe = ["MAYBE", "TBD", "TBC", "EVALUATING", "UNCERTAIN", "POSSIBLE", "UNSURE", "UNDECIDED"];
    return out.indexOf(s) !== -1 || maybe.indexOf(s) !== -1;
  }
  var scopeVal = cf(fieldMap.scope);
  var scope    = !fieldMap.scope ? "IN" : (_isOutOrMaybe(scopeVal) ? "OUT" : "IN");

  // AI usage normalisation
  var aiRaw   = cf(fieldMap.aiUsage);
  var aiUsage = null;
  if (aiRaw) {
    var al = aiRaw.toLowerCase();
    if (al.includes("led")) aiUsage = "AI Led";
    else if (al.includes("assist") || al === "yes") aiUsage = "AI Assisted";
  }

  // Auto-create the module from whatever Jira actually has, rather than requiring it to
  // match a predefined list.
  var moduleRaw = cf(fieldMap.module);
  var moduleId  = ensureModuleFor(moduleRaw);

  return {
    key:           issue.key,
    summary:       f.summary || "",
    status:        status,
    stage:         stage,
    assignee:      assigneeId,
    module:        moduleId,
    _moduleRaw:    moduleRaw,
    quarter:       resolveQuarterFromJira(cf(fieldMap.deliveryQuarter)),  // null when field is empty or value doesn't match any known quarter
    _rawQuarter:   cf(fieldMap.deliveryQuarter),
    scope:         scope,
    _scopeRaw:     scopeVal,
    hiFiEnd:       fmtDate(cf(fieldMap.hiFiDate)),
    loFiEnd:       fmtDate(cf(fieldMap.loFiDate)),
    uxStartDate:   uxStartDate,
    lastUpdated:   fmtDate(f.updated),
    finalReviewDate: finalReviewDate,
    finalReviewIsCommitted: finalReviewIsCommitted,
    size:          (function() {
      // Read Jira T-shirt size and normalize to one of S/M/L/XL/XXL.
      var raw = cf(fieldMap.size);
      if (!raw) return "M";
      var s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (["S","M","L","XL","XXL"].indexOf(s) > -1) return s;
      // Handle numeric or wordy Jira picklists like "Small", "Medium (3d)"
      if (/^SMALL/.test(s) || s === "1D" || s === "1DAY") return "S";
      if (/^MED/.test(s)   || s === "3D" || s === "3DAYS") return "M";
      if (/^LARGE/.test(s) || s === "5D" || s === "1W") return "L";
      if (/^XLARGE/.test(s)|| s === "10D"|| s === "2W") return "XL";
      if (/^XXLARGE/.test(s)|| s === "20D"|| s === "4W") return "XXL";
      return "M";
    })(),
    type:          f.issuetype ? f.issuetype.name : "Feature",
    aiUsage:       aiUsage,
    dateChanges:   changeInfo.dateChanges,
    scopeChanges:  changeInfo.scopeChanges,
    sizeChanges:   changeInfo.sizeChanges,
    changeHistory: changeInfo.changeHistory,
    lastChangedBy: changeInfo.lastChangedBy,
    addedMidSprint: false,
  };
}

// ── Quick sync from sidebar (skips wizard if already configured)
function quickSync() {
  var cfg = loadJiraConfig();
  if (!cfg.token) { openSettings(); return; }
  setStatusSyncing();
  runFullSync(function(count, err) {
    refreshStatusBar();
    if (!err) navigate(currentPage, false);
  });
}

// ── Rebuild the "This Week" bucket from live TICKETS after a Jira sync.
// WEEKLY is declared const in data.js, mutate its arrays in place, don't reassign.
// Uses the "current" quarter (QUARTERS[i].isCurrent), not the raw calendar-active
// ACTIVE_QUARTER, this team always starts real delivery a quarter early (working OND
// while it's calendar-wise still JAS), so ACTIVE_QUARTER can point at a quarter that's
// already wound down while everyone's actual work has moved to the next one. Using the
// wrong quarter here silently starved this widget while every other view (which reads
// off selectedQuarter) kept working, same tickets, two different "this week" answers.
function rebuildWeeklyFromTickets() {
  if (typeof WEEKLY === "undefined") return;
  var currentQ = QUARTERS.find(function(q){ return q.isCurrent; });
  var currentQuarterId = currentQ ? currentQ.id : ACTIVE_QUARTER;
  var today = new Date(TODAY);
  var dow   = today.getDay();
  var monday = new Date(today); monday.setDate(today.getDate() - ((dow + 6) % 7));
  var friday = new Date(monday); friday.setDate(monday.getDate() + 4);
  function fmt(d) { return d.toLocaleDateString("en-US", { month:"short", day:"numeric" }); }
  var mondayStr = monday.toISOString().slice(0,10);
  var fridayStr = friday.toISOString().slice(0,10);

  var active = TICKETS.filter(function(t){ return t.quarter === currentQuarterId && t.scope !== "OUT"; });
  var planned = active.filter(function(t){
    var d = t.hiFiEnd || t.loFiEnd;
    return d && d >= mondayStr && d <= fridayStr;
  }).map(function(t) {
    var dObj = designerById(t.assignee);
    return { key: t.key, summary: t.summary, assignee: t.assignee, pod: dObj ? dObj.pod : null, module: t.module, status: t.status };
  });
  var delivered = planned.filter(function(t){ return t.status === "Done"; }).map(function(t){ return t.key; });
  var missed    = planned.filter(function(t){ return t.status !== "Done"; }).map(function(t){ return t.key; });
  var carry     = active.filter(function(t){
    return t.status !== "Done" && t.hiFiEnd && t.hiFiEnd < mondayStr;
  }).map(function(t) {
    var dObj = designerById(t.assignee);
    return { key: t.key, summary: t.summary, assignee: t.assignee, pod: dObj ? dObj.pod : null, module: t.module, status: t.status };
  });

  WEEKLY.weekLabel = "Week of " + fmt(monday) + " – " + fmt(friday) + ", " + today.getFullYear();
  WEEKLY.planned.length      = 0; Array.prototype.push.apply(WEEKLY.planned, planned);
  WEEKLY.delivered.length    = 0; Array.prototype.push.apply(WEEKLY.delivered, delivered);
  WEEKLY.missed.length       = 0; Array.prototype.push.apply(WEEKLY.missed, missed);
  WEEKLY.carryForward.length = 0; Array.prototype.push.apply(WEEKLY.carryForward, carry);
  WEEKLY.atRisk.length       = 0;
  WEEKLY.nextWeek.length     = 0;
}

// ── Auto-sync on load (silent, if credentials exist and > 30 min since last sync)
function autoSyncOnLoad() {
  var cfg  = loadJiraConfig();
  var last = localStorage.getItem(JIRA_LAST_SYNC_KEY);
  if (!cfg.token || !cfg.url || !cfg.email || !cfg.project) return;
  // Skip if synced within the last 30 minutes
  if (last && (Date.now() - new Date(last).getTime()) < 30 * 60 * 1000) { refreshStatusBar(); return; }
  runFullSync(function(count, err) {
    if (!err) navigate(currentPage, false);
  });
}

// Each quarter's status (Current / Planning / Completed) must reflect the real calendar,
// not a value hand-set once in data.js, that field goes stale the moment real time moves
// past it (same failure mode TODAY itself had). Recomputed from TODAY vs each quarter's own
// start/end every time the app loads, so it's always right without manual upkeep.
// Underlying status stays strictly calendar-based (today falls within the quarter's own
// start/end), this is what existing behavioral logic depends on, e.g. Overview only shows
// the full metrics dashboard once a quarter is genuinely "active"; otherwise it shows the
// lightweight planning pipeline so a quarter with no real synced tickets yet doesn't look
// like a broken 0%-everywhere page.
//
// earlyStart is a separate, display-only flag: some teams start real work on a quarter
// before its calendar window opens (e.g. "we start JAS in AMJ", one quarter of lead time).
// A quarter flagged earlyStart shows "Ongoing" instead of "Planning" in the UI, without
// touching any of the behavioral gates keyed off `status`.
function syncQuarterStatuses() {
  QUARTERS.forEach(function(q, i) {
    if (TODAY > q.end) { q.status = "completed"; q.earlyStart = false; return; }
    if (TODAY >= q.start) { q.status = "active"; q.earlyStart = false; return; }
    q.status = "planning";
    var prev = QUARTERS[i - 1];
    q.earlyStart = !!(prev && TODAY >= prev.start);
  });

  // Only one quarter is ever "Current" for display. This team always starts real work on
  // next quarter's roadmap one quarter early (they work on OND while calendar-wise it's
  // still JAS), so once that early start has kicked in, the calendar-active quarter's own
  // roadmap is already done and should read as Completed, not still Current. isCurrent/
  // displayCompleted are display-only, q.status stays calendar-based so behavioral gates
  // (e.g. Overview's planning-pipeline safety check) are untouched.
  var currentIdx = -1;
  // Demo build: the early-start promotion pushed "Current" onto next quarter, which
  // opened the tool on a quarter holding no delivery work. Anchor Current to the
  // calendar-active quarter so a first-time visitor lands on the live sprint.
  QUARTERS.forEach(function(q, i) { if (q.status === "active") currentIdx = i; });
  QUARTERS.forEach(function(q, i) {
    q.isCurrent = (i === currentIdx);
    q.displayCompleted = q.status === "completed" || (currentIdx !== -1 && i < currentIdx);
  });
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function() {
  syncQuarterStatuses();
  // Default to the real "current" quarter, not the raw calendar-active one, this team
  // always starts real work a quarter early, so ACTIVE_QUARTER alone can point at a
  // quarter whose work already wound down while the page still opened on it by default.
  var _currentQ = QUARTERS.find(function(q){ return q.isCurrent; });
  if (_currentQ) selectedQuarter = _currentQ.id;
  // FIRST: restore last synced Jira data so demo Priya/Arjun/Rahul/Sneha never flash.
  loadLiveData();
  loadPods();
  loadDesignerAvailability();
  loadHolidaysFromStorage();
  renderPodFilterBar();
  refreshStatusBar();
  autoSyncOnLoad();

  // Keep "Synced Xm ago" / "Last updated Xm ago" ticking in both the sidebar and
  // topbar without needing a sync or page navigation to trigger a refresh.
  setInterval(refreshStatusBar, 30000);

  var sel = document.getElementById("quarter-sel");
  QUARTERS.forEach(function(q) {
    var o = document.createElement("option");
    o.value = q.id;
    o.textContent = q.sprintName + (q.isCurrent ? " · Current" : q.displayCompleted ? " · Done" : " · Planning");
    if (q.id === selectedQuarter) o.selected = true;
    sel.appendChild(o);
  });
  sel.addEventListener("change", function(e){ onQuarterChange(e.target.value); });
  updateTopbarBadges();
  navigate("home");

  // Global click handler: any ticket-key element opens the read-only detail panel.
  // Covers .ticket-key, .ar-key, .rr-key, .pi-key, and anything with data-jira-key.
  document.addEventListener("click", function(e) {
    var el = e.target.closest && e.target.closest(".ticket-key, .ar-key, .rr-key, .pi-key, [data-jira-key]");
    if (!el) return;
    var key = (el.dataset && el.dataset.jiraKey) || (el.textContent || "").trim();
    if (!key || !/^[A-Z]+-\d+$/i.test(key)) return;
    e.stopPropagation();  // don't also trigger a parent row's own click handler (e.g. risk-row toggle)
    openTicketPanel(key.toUpperCase());
  });
});
