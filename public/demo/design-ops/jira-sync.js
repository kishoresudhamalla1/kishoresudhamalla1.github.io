// ============================================================
//  Design Ops Dashboard  ·  Jira Sync Script
//  Run:  node jira-sync.js
//  Requires Node.js 18+ (built-in fetch) or node-fetch
// ============================================================

const fs   = require("fs");
const path = require("path");
const cfg  = require("./jira-config");

const AUTH = Buffer.from(`${cfg.email}:${cfg.apiToken}`).toString("base64");
const BASE = cfg.baseUrl;

async function jira(endpoint) {
  const res = await fetch(`${BASE}/rest/api/3/${endpoint}`, {
    headers: {
      "Authorization": `Basic ${AUTH}`,
      "Accept": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Jira API error ${res.status}: ${endpoint}`);
  return res.json();
}

// ── Helpers ──────────────────────────────────────────────────

function getDesignerById(accountId) {
  return cfg.designers.find(d => d.jiraAccountId === accountId) || null;
}

function deriveRiskFlags(ticket, today) {
  const flags = [];
  const d = (s) => s ? new Date(s) : null;
  const now = d(today);

  const finalReview = d(ticket.finalReview);
  const lastUpdated = d(ticket.lastUpdated);
  const loFi        = d(ticket.loFiEnd);

  // Overdue: final review date passed and not Done
  if (finalReview && finalReview < now && ticket.status !== "Done")
    flags.push("overdue");

  // Due soon: final review within 7 days and not Done
  const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
  if (finalReview && finalReview > now && finalReview <= sevenDays && ticket.status !== "Done")
    flags.push("due-soon");

  // Stale: no update in 14+ days
  if (lastUpdated) {
    const daysSince = (now - lastUpdated) / (1000 * 60 * 60 * 24);
    if (daysSince >= 21 && ticket.status !== "Done") flags.push("no-update");
    else if (daysSince >= 14 && ticket.status !== "Done") flags.push("stale");
  }

  // Missing lo-fi date
  if (!loFi && ticket.status === "To Do") flags.push("missing-prd");

  return flags;
}

function extractAIUsage(labels) {
  if (!labels) return null;
  if (labels.includes("AI-Led"))       return "AI Led";
  if (labels.includes("AI-Assisted"))  return "AI Assisted";
  return null;
}

function extractPod(labels, customField) {
  if (cfg.useLabelForPod) {
    if (labels.includes("pod-a")) return "pod-a";
    if (labels.includes("pod-b")) return "pod-b";
  }
  return customField || null;
}

function extractScope(labels) {
  if (labels.includes("out-of-scope")) return "OUT";
  return "IN";
}

function mapStatus(jiraStatus) {
  return cfg.statusMap[jiraStatus] || jiraStatus;
}

function mapSize(points, tshirtField) {
  if (tshirtField) return tshirtField; // prefer explicit T-shirt field
  return cfg.sizeFromPoints(points);
}

function isoDate(str) {
  if (!str) return null;
  return str.split("T")[0]; // strip time component if present
}

// ── Fetch all tickets for the project ────────────────────────

async function fetchAllTickets(projectKey) {
  const tickets = [];
  let startAt = 0;
  const maxResults = 100;

  while (true) {
    const jql = encodeURIComponent(
      `project = "${projectKey}" ORDER BY created DESC`
    );
    const fieldList = [
      "summary", "assignee", "status", "issuetype",
      "labels", "components", "updated", "comment",
      cfg.fields.storyPoints, cfg.fields.tshirtSize,
      cfg.fields.pod, cfg.fields.loFiDate, cfg.fields.hiFiDate,
      cfg.fields.podReview, cfg.fields.finalReview, cfg.fields.aiUsage,
    ].join(",");

    const data = await jira(
      `search?jql=${jql}&startAt=${startAt}&maxResults=${maxResults}&fields=${fieldList}`
    );

    tickets.push(...data.issues);
    startAt += data.issues.length;
    if (startAt >= data.total) break;
  }

  return tickets;
}

// ── Map a raw Jira issue to dashboard ticket format ──────────

function mapTicket(issue, today) {
  const f = issue.fields;
  const labels   = f.labels || [];
  const assignee = getDesignerById(f.assignee?.accountId);
  const pod      = assignee?.pod || extractPod(labels, f[cfg.fields.pod]);

  const ticket = {
    key:          issue.key,
    summary:      f.summary,
    assignee:     assignee?.id || null,
    pod:          pod,
    module:       f.components?.[0]?.name?.toLowerCase().replace(/\s+/g, "-") || null,
    type:         f.issuetype?.name || "Task",
    size:         mapSize(f[cfg.fields.storyPoints], f[cfg.fields.tshirtSize]),
    quarter:      null,           // derived below from dates
    startDate:    null,           // Jira doesn't have a native start date, set via custom field or sprint start
    loFiEnd:      isoDate(f[cfg.fields.loFiDate]),
    hiFiEnd:      isoDate(f[cfg.fields.hiFiDate]),
    podReview:    isoDate(f[cfg.fields.podReview]),
    finalReview:  isoDate(f[cfg.fields.finalReview]),
    status:       mapStatus(f.status?.name),
    scope:        extractScope(labels),
    comments:     f.comment?.comments?.slice(-1)[0]?.body?.content?.[0]?.content?.[0]?.text || "",
    riskFlags:    [],
    lastUpdated:  isoDate(f.updated),
    dateChanges:  [],             // Jira changelog API needed for full history, see note below
    aiUsage:      cfg.useLabelForAI
                    ? extractAIUsage(labels)
                    : (f[cfg.fields.aiUsage] || null),
  };

  ticket.riskFlags = deriveRiskFlags(ticket, today);
  return ticket;
}

// ── Derive active quarter from today's date ───────────────────

function deriveQuarters(today) {
  const d = new Date(today);
  const y = d.getFullYear();
  const m = d.getMonth(); // 0-indexed
  const quarters = [
    { id:`q1-${y}`, label:`Q1 ${y}`, start:`${y}-01-01`, end:`${y}-03-31`, status:"completed", color:"#10b981" },
    { id:`q2-${y}`, label:`Q2 ${y}`, start:`${y}-04-01`, end:`${y}-06-30`, status:"completed", color:"#10b981" },
    { id:`q3-${y}`, label:`Q3 ${y}`, start:`${y}-07-01`, end:`${y}-09-30`, status:"active",    color:"#6366f1" },
    { id:`q4-${y}`, label:`Q4 ${y}`, start:`${y}-10-01`, end:`${y}-12-31`, status:"planning",  color:"#f59e0b" },
  ];
  const active = m < 3 ? `q1-${y}` : m < 6 ? `q2-${y}` : m < 9 ? `q3-${y}` : `q4-${y}`;
  return { quarters, active };
}

function assignQuarter(ticket, quarters) {
  const ref = ticket.finalReview || ticket.hiFiEnd || ticket.loFiEnd;
  if (!ref) return null;
  const d = new Date(ref);
  for (const q of quarters) {
    if (d >= new Date(q.start) && d <= new Date(q.end)) return q.id;
  }
  return null;
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const today = new Date().toISOString().split("T")[0];
  console.log(`\n🔄  Syncing from Jira project: ${cfg.projectKey}`);
  console.log(`    Base URL : ${BASE}`);
  console.log(`    Date     : ${today}\n`);

  let rawIssues;
  try {
    rawIssues = await fetchAllTickets(cfg.projectKey);
  } catch (e) {
    console.error("❌  Failed to fetch from Jira:", e.message);
    console.error("    Check your baseUrl, email, and apiToken in jira-config.js");
    process.exit(1);
  }

  console.log(`✅  Fetched ${rawIssues.length} tickets from Jira`);

  const { quarters, active } = deriveQuarters(today);

  const TICKETS = rawIssues
    .map(issue => {
      const t = mapTicket(issue, today);
      t.quarter = assignQuarter(t, quarters);
      return t;
    })
    .filter(t => t.assignee !== null); // skip unassigned tickets

  console.log(`    Mapped ${TICKETS.length} tickets with known assignees`);

  // ── Write data.js ─────────────────────────────────────────

  const output = `// ============================================================
//  Design Ops Dashboard  ·  Data Layer  (auto-generated)
//  Synced from Jira project: ${cfg.projectKey}
//  Generated : ${today}
//  DO NOT EDIT, run: node jira-sync.js
// ============================================================

const TODAY = "${today}";

const QUARTERS = ${JSON.stringify(quarters, null, 2)};
const ACTIVE_QUARTER = "${active}";

const DESIGNERS = ${JSON.stringify(cfg.designers.map(d => ({
    id: d.id, name: d.name, pod: d.pod, initials: d.initials, color: d.color
  })), null, 2)};

const POD_MANAGERS = [
  { id:"pod-a", name:"Kiran Desai",  initials:"KD",
    designers:${JSON.stringify(cfg.designers.filter(d=>d.pod==="pod-a").map(d=>d.id))},
    modules:["hire","core-platform","analytics","design-system"] },
  { id:"pod-b", name:"Meera Pillai", initials:"MP",
    designers:${JSON.stringify(cfg.designers.filter(d=>d.pod==="pod-b").map(d=>d.id))},
    modules:["ess","learning","performance","reports"] },
];

const MODULES = [
  { id:"hire",          name:"Hire",                  pod:"pod-a", color:"#6366f1", icon:"👤" },
  { id:"core-platform", name:"Core Platform",         pod:"pod-a", color:"#8b5cf6", icon:"⚙️"  },
  { id:"analytics",     name:"Analytics",             pod:"pod-a", color:"#3b82f6", icon:"📊" },
  { id:"design-system", name:"Design System",         pod:"pod-a", color:"#10b981", icon:"✦"  },
  { id:"ess",           name:"Employee Self-Service", pod:"pod-b", color:"#ec4899", icon:"🏢" },
  { id:"learning",      name:"Learning Portal",       pod:"pod-b", color:"#f59e0b", icon:"📚" },
  { id:"performance",   name:"Performance Mgmt",      pod:"pod-b", color:"#ef4444", icon:"🎯" },
  { id:"reports",       name:"Reports",               pod:"pod-b", color:"#64748b", icon:"📋" },
];

const SIZES = { S:1, M:3, L:5, XL:10, XXL:20 };

const RISK_LABELS = {
  "overdue":      { label:"Overdue",        severity:"red",   icon:"⏰" },
  "scope-change": { label:"Scope Changed",  severity:"red",   icon:"🔄" },
  "blocker":      { label:"Blocked",        severity:"red",   icon:"🚫" },
  "no-update":    { label:"No Update 3w+",  severity:"red",   icon:"🔕" },
  "missing-prd":  { label:"Missing PRD",    severity:"amber", icon:"📋" },
  "due-soon":     { label:"Due Soon",       severity:"amber", icon:"⚠️"  },
  "stale":        { label:"Stale 2w+",      severity:"amber", icon:"💤" },
  "date-drifted": { label:"Dates Drifted",  severity:"amber", icon:"📅" },
};

const CAPACITY = { overloaded:40, at_risk:25, healthy:12 };

const TICKETS = ${JSON.stringify(TICKETS, null, 2)};

// Planning and Weekly Digest, update manually or extend this script
const PLANNING_TICKETS = [];
const WEEKLY = { weekLabel:"", planned:[], delivered:[], missed:[], carryForward:[], atRisk:[], nextWeek:[] };
`;

  const outPath = path.join(__dirname, "data.js");
  fs.writeFileSync(outPath, output, "utf8");
  console.log(`\n✅  data.js written → ${outPath}`);
  console.log(`    ${TICKETS.length} tickets · active quarter: ${active}`);
  console.log(`\n    ⚠️  PLANNING_TICKETS and WEEKLY digest are not pulled from Jira.`);
  console.log(`    Update those sections manually in data.js, or ask a dev to extend this script.\n`);
}

main();
