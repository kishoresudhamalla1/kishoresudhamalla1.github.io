// ============================================================
//  Design Ops Dashboard  ·  Data Layer  ·  v2
// ============================================================

// TODAY drives every date calculation in the app, overdue detection, working-days-left,
// sprint pace, This Week bucketing, staleness. It MUST track the real calendar date, not
// a value frozen at build time (a hardcoded string here silently broke all of the above
// once real time moved past it, every ticket looked "on track" forever).
const TODAY = new Date().toISOString().slice(0, 10);

// Public / company holidays, ISO strings (YYYY-MM-DD). Excluded from working-day math.
// Add your org's holiday calendar here, the dashboard automatically respects it.
const HOLIDAYS = [
  "2026-08-15",  // Independence Day
  "2026-10-02",  // Gandhi Jayanti
  "2026-11-11",  // Diwali (example)
  "2026-12-25",  // Christmas
];

// ── Quarters ──────────────────────────────────────────────────
const QUARTERS = [
  { id:"q1-2026", label:"Q1 2026", sprintName:"UX_JFM 26", start:"2026-01-01", end:"2026-03-31", status:"completed", color:"#10b981",
    committed:14, scopeAdded:2, delivered:12, dropped:2, spilled:2,
    cutlineNote:"2 epics dropped (de-scoped by PM). 2 spilled to Q2 due to stakeholder delays.",
    designerPerf:[
      { id:"priya", epics:4, done:4, dropped:0, spilled:0 },
      { id:"arjun", epics:4, done:3, dropped:1, spilled:0 },
      { id:"rahul", epics:4, done:3, dropped:1, spilled:0 },
      { id:"sneha", epics:4, done:2, dropped:0, spilled:2 },
    ]},
  { id:"q2-2026", label:"Q2 2026", sprintName:"UX_AMJ 26", start:"2026-04-01", end:"2026-06-30", status:"completed", color:"#10b981",
    committed:16, scopeAdded:5, delivered:18, dropped:1, spilled:2,
    cutlineNote:"1 epic dropped mid-sprint (priority shift). 2 spilled to Q3, both in progress.",
    designerPerf:[
      { id:"priya", epics:5, done:5, dropped:0, spilled:0 },
      { id:"arjun", epics:6, done:5, dropped:1, spilled:0 },
      { id:"rahul", epics:5, done:4, dropped:0, spilled:1 },
      { id:"sneha", epics:5, done:4, dropped:0, spilled:1 },
    ]},
  { id:"q3-2026", label:"Q3 2026", sprintName:"UX_JAS 26", start:"2026-07-01", end:"2026-09-30", status:"active",    color:"#6366f1",
    committed:20, scopeAdded:3, delivered:null, dropped:null, spilled:null, cutlineNote:null },
  { id:"q4-2026", label:"Q4 2026", sprintName:"UX_OND 26", start:"2026-10-01", end:"2026-12-31", status:"active",  color:"#f59e0b",
    committed:16, scopeAdded:1, delivered:null, dropped:1, spilled:null,
    cutlineNote:"1 epic de-scoped at cutline (Notification Digest). 1 added mid-sprint after a client escalation.",
    designerPerf:[
      { id:"priya", epics:4, done:1, dropped:0, spilled:0 },
      { id:"arjun", epics:4, done:0, dropped:1, spilled:0 },
      { id:"rahul", epics:4, done:1, dropped:0, spilled:0 },
      { id:"sneha", epics:4, done:0, dropped:0, spilled:0 },
    ]},
];
// Derived from TODAY, not hand-picked, same reasoning as TODAY itself: a hardcoded quarter
// id silently goes stale the moment real time crosses into the next quarter. Falls back to
// the last-defined quarter if TODAY somehow falls outside every range (shouldn't happen with
// contiguous quarters, but avoids `undefined` behavior if it ever does).
const ACTIVE_QUARTER = (function() {
  var hit = QUARTERS.find(function(q){ return TODAY >= q.start && TODAY <= q.end; });
  return hit ? hit.id : QUARTERS[QUARTERS.length - 1].id;
})();

// ── Designers ─────────────────────────────────────────────────
const DESIGNERS = [
  { id:"priya", name:"Priya Sharma", pod:"pod-a", initials:"PS", color:"#6366f1" },
  { id:"arjun", name:"Arjun Mehta",  pod:"pod-a", initials:"AM", color:"#8b5cf6" },
  { id:"rahul", name:"Rahul Nair",   pod:"pod-b", initials:"RN", color:"#ec4899" },
  { id:"sneha", name:"Sneha Rao",    pod:"pod-b", initials:"SR", color:"#f59e0b" },
];

// ── Pod Managers ──────────────────────────────────────────────
const POD_MANAGERS = [
  { id:"pod-a", name:"Kiran Desai",  initials:"KD", designers:["priya","arjun"],
    modules:["hire","core-platform","analytics","design-system"] },
  { id:"pod-b", name:"Meera Pillai", initials:"MP", designers:["rahul","sneha"],
    modules:["ess","learning","performance","reports"] },
];

// ── Modules ───────────────────────────────────────────────────
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

// ── Sizes → days ──────────────────────────────────────────────
const SIZES = { S:1, M:3, L:5, XL:10, XXL:20 };  // T-shirt sizing in working days

// ── Risk flag meta ────────────────────────────────────────────
const RISK_LABELS = {
  "overdue":      { label:"Overdue",          severity:"red",   icon:"⏰" },
  "scope-change": { label:"Scope Changed",    severity:"red",   icon:"🔄" },
  "blocker":      { label:"Blocked",          severity:"red",   icon:"🚫" },
  "no-update":    { label:"No Update 3w+",    severity:"red",   icon:"🔕" },
  "missing-prd":  { label:"Missing PRD",      severity:"red",   icon:"📋" },
  "due-soon":     { label:"Due Soon",         severity:"red",   icon:"⚠️"  },
  "stale":        { label:"Stale 2w+",        severity:"red",   icon:"💤" },
  "date-drifted": { label:"Dates Drifted",    severity:"red",   icon:"📅" },
};

// ── Capacity thresholds (remaining days) ──────────────────────
const CAPACITY = {
  overloaded: 40,   // > 40d remaining → overloaded
  at_risk:    25,   // 25-40d → at risk
  healthy:    12,   // 12-25d → healthy
  // < 12d → available
};

// ─────────────────────────────────────────────────────────────
//  TICKETS
//  Fields: key, summary, assignee, pod, module, type, size,
//          quarter, startDate, loFiEnd, hiFiEnd, podReview,
//          finalReview, status, scope, comments,
//          riskFlags, lastUpdated, dateChanges[],
//          aiUsage: null | "AI Assisted" | "AI Led"
// ─────────────────────────────────────────────────────────────

const TICKETS = [

  // ══════════════════════════════════════════════════════════
  //  Q3 2026. Active Quarter
  // ══════════════════════════════════════════════════════════

  // ── PRIYA (Pod A), heavy AI user ─────────────────────────
  {
    key:"UX-101", summary:"Checkout Flow Revamp, 3-Step Consolidation",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"Revamp", size:"XL", quarter:"q3-2026",
    startDate:"2026-07-01", loFiEnd:"2026-07-14", hiFiEnd:"2026-07-25",
    podReview:"2026-07-28", finalReview:"2026-08-01",
    status:"Done", scope:"IN",
    comments:"Shipped. Positive stakeholder feedback. 3-step reduction validated.",
    riskFlags:[], lastUpdated:"2026-08-01",
    dateChanges:[], aiUsage:"AI Led",
  },
  {
    key:"UX-102", summary:"Onboarding Wizard. New User Research",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"Research", size:"L", quarter:"q3-2026",
    startDate:"2026-07-15", loFiEnd:"2026-07-22", hiFiEnd:"2026-07-29",
    podReview:"2026-08-01", finalReview:"2026-08-05",
    status:"Done", scope:"IN",
    comments:"5 user interviews done. Insights deck shared with PM.",
    riskFlags:[], lastUpdated:"2026-08-05",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-103", summary:"Dashboard Personalization. Feature Flags UI",
    assignee:"priya", pod:"pod-a", module:"analytics",
    type:"New Feature", size:"L", quarter:"q3-2026",
    startDate:"2026-08-01", loFiEnd:"2026-08-10", hiFiEnd:"2026-08-20",
    podReview:"2026-08-22", finalReview:"2026-08-26",
    status:"In Review", scope:"IN",
    comments:"Hi-fi in pod review. Minor feedback on toggle states.",
    riskFlags:[], lastUpdated:"2026-07-12",
    dateChanges:[], aiUsage:"AI Led",
  },
  {
    key:"UX-104", summary:"Notification Center. Preference Manager",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"New Feature", size:"M", quarter:"q3-2026",
    startDate:"2026-08-20", loFiEnd:"2026-08-25", hiFiEnd:"2026-09-02",
    podReview:"2026-09-05", finalReview:"2026-09-10",
    status:"In Progress", stage:"HI-FI", scope:"IN",
    comments:"Lo-fi approved. Moving to hi-fi this week.",
    riskFlags:[], lastUpdated:"2026-07-13",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-105", summary:"Search Results Revamp. Filter Panel Redesign",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"Revamp", size:"XXL", quarter:"q3-2026",
    startDate:"2026-09-01", loFiEnd:"2026-09-15", hiFiEnd:"2026-09-25",
    podReview:"2026-09-28", finalReview:"2026-10-02",
    status:"To Do", scope:"IN",
    comments:"PRD still pending. Design hasn't started. Dates pushed twice.",
    riskFlags:["missing-prd","due-soon","date-drifted"], lastUpdated:"2026-06-28",
    dateChanges:[
      { date:"2026-07-05", field:"hiFiEnd", from:"2026-09-10", to:"2026-09-25", reason:"PRD not ready" },
      { date:"2026-07-12", field:"finalReview", from:"2026-09-20", to:"2026-10-02", reason:"PM delayed brief" },
    ], aiUsage:null,
  },
  {
    key:"UX-106", summary:"Hire. JD Template Builder (New Feature)",
    assignee:"priya", pod:"pod-a", module:"hire",
    type:"New Feature", size:"XL", quarter:"q3-2026",
    startDate:"2026-09-05", loFiEnd:"2026-09-18", hiFiEnd:"2026-09-26",
    podReview:"2026-09-29", finalReview:"2026-10-03",
    status:"To Do", scope:"IN",
    comments:"Added mid-sprint by PM. No lo-fi started. Pushes Priya's load over limit.",
    riskFlags:["due-soon","stale"], lastUpdated:"2026-06-25",
    dateChanges:[], aiUsage:null,
    addedMidSprint:true, addedAt:"2026-09-05",
  },

  // ── ARJUN (Pod A), moderate AI user ──────────────────────
  {
    key:"UX-201", summary:"Design System. Button Component v2",
    assignee:"arjun", pod:"pod-a", module:"design-system",
    type:"Pattern", size:"M", quarter:"q3-2026",
    startDate:"2026-07-01", loFiEnd:"2026-07-08", hiFiEnd:"2026-07-15",
    podReview:"2026-07-17", finalReview:"2026-07-21",
    status:"Done", scope:"IN",
    comments:"Published to Figma library. Storybook docs updated.",
    riskFlags:[], lastUpdated:"2026-07-21",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-202", summary:"Mobile Navigation. Bottom Tab Bar Pattern",
    assignee:"arjun", pod:"pod-a", module:"design-system",
    type:"Pattern", size:"L", quarter:"q3-2026",
    startDate:"2026-07-14", loFiEnd:"2026-07-22", hiFiEnd:"2026-07-31",
    podReview:"2026-08-04", finalReview:"2026-08-07",
    status:"Done", scope:"IN",
    comments:"Merged into DS. Dev handoff complete.",
    riskFlags:[], lastUpdated:"2026-08-07",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-203", summary:"Analytics Dashboard. Chart Type Exploration",
    assignee:"arjun", pod:"pod-a", module:"analytics",
    type:"Research", size:"M", quarter:"q3-2026",
    startDate:"2026-08-01", loFiEnd:"2026-08-07", hiFiEnd:"2026-08-14",
    podReview:"2026-08-18", finalReview:"2026-08-21",
    status:"In Progress", scope:"IN",
    comments:"Competitive analysis 70% done. Benchmark doc in Notion.",
    riskFlags:[], lastUpdated:"2026-07-10",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-204", summary:"Profile Settings. UX Signoff for Engineering",
    assignee:"arjun", pod:"pod-a", module:"core-platform",
    type:"UX Signoff", size:"S", quarter:"q3-2026",
    startDate:"2026-07-28", loFiEnd:"2026-07-29", hiFiEnd:"2026-07-30",
    podReview:"2026-07-31", finalReview:"2026-08-02",
    status:"Done", scope:"IN",
    comments:"Signed off. Dev queries resolved in 2 days.",
    riskFlags:[], lastUpdated:"2026-08-02",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-205", summary:"Billing Page Revamp. Scope Changed Mid-Sprint",
    assignee:"arjun", pod:"pod-a", module:"core-platform",
    type:"Revamp", size:"XL", quarter:"q3-2026",
    startDate:"2026-08-10", loFiEnd:"2026-08-22", hiFiEnd:"2026-09-05",
    podReview:"2026-09-08", finalReview:"2026-09-12",
    status:"In Progress", stage:"HI-FI", scope:"IN",
    comments:"PM added 3 new requirements after lo-fi was approved. Hi-fi timeline at risk.",
    riskFlags:["scope-change","date-drifted"], lastUpdated:"2026-07-11",
    dateChanges:[
      { date:"2026-07-07", field:"hiFiEnd", from:"2026-08-15", to:"2026-08-22", reason:"Scope addition from PM" },
      { date:"2026-07-11", field:"hiFiEnd", from:"2026-08-22", to:"2026-09-05", reason:"Additional scope, promo banner" },
      { date:"2026-07-11", field:"finalReview", from:"2026-09-01", to:"2026-09-12", reason:"Cascading delay" },
    ], aiUsage:"AI Assisted",
  },
  {
    key:"UX-206", summary:"Hire. Offer Letter Workflow Redesign",
    assignee:"arjun", pod:"pod-a", module:"hire",
    type:"Revamp", size:"XXL", quarter:"q3-2026",
    startDate:"2026-09-01", loFiEnd:"2026-09-18", hiFiEnd:"2026-09-28",
    podReview:"2026-09-30", finalReview:"2026-10-05",
    status:"To Do", scope:"IN",
    comments:"Added to Q3 late. Very large ticket. PRD under review.",
    riskFlags:["missing-prd","due-soon","stale"], lastUpdated:"2026-06-20",
    dateChanges:[], aiUsage:null,
    addedMidSprint:true, addedAt:"2026-09-01",
  },
  {
    key:"UX-207", summary:"Analytics. Real-Time KPI Widget Pattern",
    assignee:"arjun", pod:"pod-a", module:"analytics",
    type:"Pattern", size:"L", quarter:"q3-2026",
    startDate:"2026-09-05", loFiEnd:"2026-09-12", hiFiEnd:"2026-09-19",
    podReview:"2026-09-23", finalReview:"2026-09-26",
    status:"To Do", scope:"IN",
    comments:"Not started. Dependent on UX-203 research completion.",
    riskFlags:["due-soon"], lastUpdated:"2026-07-01",
    dateChanges:[], aiUsage:null,
  },

  // ── RAHUL (Pod B), light AI user ─────────────────────────
  {
    key:"UX-301", summary:"Hire Module. Job Posting Form Revamp",
    assignee:"rahul", pod:"pod-b", module:"hire",
    type:"Revamp", size:"L", quarter:"q3-2026",
    startDate:"2026-07-01", loFiEnd:"2026-07-10", hiFiEnd:"2026-07-22",
    podReview:"2026-07-25", finalReview:"2026-07-29",
    status:"Done", scope:"IN",
    comments:"Delivered on time. Dev picked up immediately.",
    riskFlags:[], lastUpdated:"2026-07-29",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-302", summary:"Candidate Pipeline. Drag & Drop Kanban",
    assignee:"rahul", pod:"pod-b", module:"hire",
    type:"New Feature", size:"XXL", quarter:"q3-2026",
    startDate:"2026-07-15", loFiEnd:"2026-08-05", hiFiEnd:"2026-08-25",
    podReview:"2026-08-28", finalReview:"2026-09-02",
    status:"In Progress", scope:"IN",
    comments:"Complex interaction states under review. On track.",
    riskFlags:[], lastUpdated:"2026-07-13",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-303", summary:"Reports Module. UX Signoff Overdue",
    assignee:"rahul", pod:"pod-b", module:"reports",
    type:"UX Signoff", size:"S", quarter:"q3-2026",
    startDate:"2026-07-20", loFiEnd:"2026-07-21", hiFiEnd:"2026-07-22",
    podReview:"2026-07-23", finalReview:"2026-07-25",
    status:"In Progress", scope:"IN",
    comments:"Dev kept sending new queries. Signoff delayed 3 weeks. No resolution in sight.",
    riskFlags:["overdue","no-update","date-drifted"], lastUpdated:"2026-06-22",
    dateChanges:[
      { date:"2026-07-01", field:"finalReview", from:"2026-07-10", to:"2026-07-25", reason:"Dev query backlog" },
      { date:"2026-07-08", field:"finalReview", from:"2026-07-25", to:"2026-08-01", reason:"Still unresolved" },
    ], aiUsage:null,
  },
  {
    key:"UX-304", summary:"Employee Self-Service. Accessibility Audit",
    assignee:"rahul", pod:"pod-b", module:"ess",
    type:"Research", size:"M", quarter:"q3-2026",
    startDate:"2026-08-05", loFiEnd:"2026-08-11", hiFiEnd:"2026-08-18",
    podReview:"2026-08-20", finalReview:"2026-08-25",
    status:"In Review", scope:"IN",
    comments:"WCAG 2.1 AA audit done. Report shared with engineering lead.",
    riskFlags:[], lastUpdated:"2026-07-08",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-305", summary:"Leave Management. Calendar Component Pattern",
    assignee:"rahul", pod:"pod-b", module:"ess",
    type:"Pattern", size:"L", quarter:"q3-2026",
    startDate:"2026-09-01", loFiEnd:"2026-09-10", hiFiEnd:"2026-09-20",
    podReview:"2026-09-23", finalReview:"2026-09-26",
    status:"To Do", scope:"IN",
    comments:"Blocked on UX-302 completion. Design not started.",
    riskFlags:["due-soon","blocker"], lastUpdated:"2026-07-02",
    dateChanges:[], aiUsage:null,
  },

  // ── SNEHA (Pod B), minimal AI usage ──────────────────────
  {
    key:"UX-401", summary:"Learning Portal. Course Cards New Design",
    assignee:"sneha", pod:"pod-b", module:"learning",
    type:"New Feature", size:"M", quarter:"q3-2026",
    startDate:"2026-07-01", loFiEnd:"2026-07-07", hiFiEnd:"2026-07-15",
    podReview:"2026-07-17", finalReview:"2026-07-22",
    status:"Done", scope:"IN",
    comments:"A/B test launched. CTR up 12%. PM very happy.",
    riskFlags:[], lastUpdated:"2026-07-22",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-402", summary:"Performance Review. Star Rating Widget Pattern",
    assignee:"sneha", pod:"pod-b", module:"performance",
    type:"Pattern", size:"S", quarter:"q3-2026",
    startDate:"2026-07-22", loFiEnd:"2026-07-23", hiFiEnd:"2026-07-25",
    podReview:"2026-07-28", finalReview:"2026-07-30",
    status:"Done", scope:"IN",
    comments:"Clean pattern. Documented in Figma library.",
    riskFlags:[], lastUpdated:"2026-07-30",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-403", summary:"Goal Setting Module. OKR Tree Visualization",
    assignee:"sneha", pod:"pod-b", module:"performance",
    type:"New Feature", size:"XL", quarter:"q3-2026",
    startDate:"2026-08-01", loFiEnd:"2026-08-12", hiFiEnd:"2026-08-25",
    podReview:"2026-08-28", finalReview:"2026-09-03",
    status:"In Progress", scope:"IN",
    comments:"Exploring data hierarchy models. Lo-fi v1 ready.",
    riskFlags:[], lastUpdated:"2026-07-14",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-404", summary:"Payslip Download. OUT of Scope Q3",
    assignee:"sneha", pod:"pod-b", module:"ess",
    type:"UX Signoff", size:"S", quarter:"q3-2026",
    startDate:"2026-08-15", loFiEnd:"2026-08-16", hiFiEnd:"2026-08-17",
    podReview:"2026-08-18", finalReview:"2026-08-20",
    status:"To Do", scope:"OUT",
    comments:"Deprioritized by PO. Moved to Q4.",
    riskFlags:[], lastUpdated:"2026-07-01",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-405", summary:"Succession Planning. Feature Research",
    assignee:"sneha", pod:"pod-b", module:"performance",
    type:"Research", size:"L", quarter:"q3-2026",
    startDate:"2026-09-05", loFiEnd:"2026-09-15", hiFiEnd:"2026-09-22",
    podReview:"2026-09-25", finalReview:"2026-09-29",
    status:"To Do", scope:"IN",
    comments:"Not started. Due at end of quarter. Missing PRD sign-off from PM.",
    riskFlags:["missing-prd","due-soon"], lastUpdated:"2026-07-03",
    dateChanges:[], aiUsage:null,
    addedMidSprint:true, addedAt:"2026-08-18",
  },

  // ══════════════════════════════════════════════════════════
  //  Q2 2026. Completed Quarter
  // ══════════════════════════════════════════════════════════

  { key:"UX-Q2-01", summary:"Job Offer Card Redesign", assignee:"priya", pod:"pod-a", module:"hire", type:"Revamp", size:"M", quarter:"q2-2026", startDate:"2026-04-01", loFiEnd:"2026-04-07", hiFiEnd:"2026-04-15", podReview:"2026-04-17", finalReview:"2026-04-22", status:"Done", scope:"IN", comments:"On time.", riskFlags:[], lastUpdated:"2026-04-22", dateChanges:[], aiUsage:"AI Assisted" },
  { key:"UX-Q2-02", summary:"Sidebar Navigation Revamp", assignee:"priya", pod:"pod-a", module:"core-platform", type:"Revamp", size:"L", quarter:"q2-2026", startDate:"2026-04-15", loFiEnd:"2026-04-25", hiFiEnd:"2026-05-05", podReview:"2026-05-08", finalReview:"2026-05-12", status:"Done", scope:"IN", comments:"1 date slip.", riskFlags:[], lastUpdated:"2026-05-12", dateChanges:[{ date:"2026-04-28", field:"hiFiEnd", from:"2026-05-01", to:"2026-05-05", reason:"Additional screens" }], aiUsage:"AI Led" },
  { key:"UX-Q2-03", summary:"Design System. Form Fields v2", assignee:"arjun", pod:"pod-a", module:"design-system", type:"Pattern", size:"XL", quarter:"q2-2026", startDate:"2026-04-01", loFiEnd:"2026-04-15", hiFiEnd:"2026-04-28", podReview:"2026-05-01", finalReview:"2026-05-05", status:"Done", scope:"IN", comments:"Shipped. Used across 8 modules.", riskFlags:[], lastUpdated:"2026-05-05", dateChanges:[], aiUsage:"AI Assisted" },
  { key:"UX-Q2-04", summary:"Icon System, 120 New Icons", assignee:"arjun", pod:"pod-a", module:"design-system", type:"Pattern", size:"L", quarter:"q2-2026", startDate:"2026-05-01", loFiEnd:"2026-05-12", hiFiEnd:"2026-05-22", podReview:"2026-05-26", finalReview:"2026-05-30", status:"Done", scope:"IN", comments:"Delivered. Eng integration ongoing.", riskFlags:[], lastUpdated:"2026-05-30", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-05", summary:"Interview Scheduling UX", assignee:"rahul", pod:"pod-b", module:"hire", type:"New Feature", size:"XL", quarter:"q2-2026", startDate:"2026-04-01", loFiEnd:"2026-04-18", hiFiEnd:"2026-05-02", podReview:"2026-05-06", finalReview:"2026-05-10", status:"Done", scope:"IN", comments:"Complex flow. Delivered with 3d slip.", riskFlags:[], lastUpdated:"2026-05-13", dateChanges:[{ date:"2026-04-25", field:"finalReview", from:"2026-05-07", to:"2026-05-10", reason:"Extra edge cases" }], aiUsage:null },
  { key:"UX-Q2-06", summary:"ESS. Leave Request Redesign", assignee:"rahul", pod:"pod-b", module:"ess", type:"Revamp", size:"M", quarter:"q2-2026", startDate:"2026-05-01", loFiEnd:"2026-05-08", hiFiEnd:"2026-05-16", podReview:"2026-05-20", finalReview:"2026-05-23", status:"Done", scope:"IN", comments:"Clean execution.", riskFlags:[], lastUpdated:"2026-05-23", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-07", summary:"Learning. Quiz Module UX", assignee:"sneha", pod:"pod-b", module:"learning", type:"New Feature", size:"L", quarter:"q2-2026", startDate:"2026-04-01", loFiEnd:"2026-04-12", hiFiEnd:"2026-04-22", podReview:"2026-04-25", finalReview:"2026-04-30", status:"Done", scope:"IN", comments:"Ahead of schedule by 2d.", riskFlags:[], lastUpdated:"2026-04-30", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-08", summary:"Performance, 360 Feedback Form", assignee:"sneha", pod:"pod-b", module:"performance", type:"New Feature", size:"XL", quarter:"q2-2026", startDate:"2026-05-05", loFiEnd:"2026-05-19", hiFiEnd:"2026-06-02", podReview:"2026-06-05", finalReview:"2026-06-10", status:"Done", scope:"IN", comments:"Positive feedback from HR.", riskFlags:[], lastUpdated:"2026-06-10", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-09", summary:"Analytics. Funnel Chart Component", assignee:"priya", pod:"pod-a", module:"analytics", type:"Pattern", size:"M", quarter:"q2-2026", startDate:"2026-05-20", loFiEnd:"2026-05-27", hiFiEnd:"2026-06-04", podReview:"2026-06-06", finalReview:"2026-06-10", status:"Done", scope:"IN", comments:"Shipped to DS.", riskFlags:[], lastUpdated:"2026-06-10", dateChanges:[], aiUsage:"AI Led" },
  { key:"UX-Q2-10", summary:"Hire. Bulk Candidate Actions", assignee:"arjun", pod:"pod-a", module:"hire", type:"New Feature", size:"L", quarter:"q2-2026", startDate:"2026-06-01", loFiEnd:"2026-06-10", hiFiEnd:"2026-06-18", podReview:"2026-06-20", finalReview:"2026-06-25", status:"Done", scope:"IN", comments:"Last ticket of Q2. Smooth.", riskFlags:[], lastUpdated:"2026-06-25", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-11", summary:"Reports. Export Template UX", assignee:"rahul", pod:"pod-b", module:"reports", type:"New Feature", size:"M", quarter:"q2-2026", startDate:"2026-06-05", loFiEnd:"2026-06-12", hiFiEnd:"2026-06-20", podReview:"2026-06-23", finalReview:"2026-06-27", status:"Done", scope:"IN", comments:"Clean delivery.", riskFlags:[], lastUpdated:"2026-06-27", dateChanges:[], aiUsage:null },
  { key:"UX-Q2-12", summary:"ESS. Org Chart Viewer Research", assignee:"sneha", pod:"pod-b", module:"ess", type:"Research", size:"L", quarter:"q2-2026", startDate:"2026-06-02", loFiEnd:"2026-06-12", hiFiEnd:"2026-06-20", podReview:"2026-06-24", finalReview:"2026-06-27", status:"Done", scope:"IN", comments:"Research insights archived.", riskFlags:[], lastUpdated:"2026-06-27", dateChanges:[], aiUsage:null },

  // ══════════════════════════════════════════════════════════
  //  Q1 2026. Completed Quarter
  // ══════════════════════════════════════════════════════════

  { key:"UX-Q1-01", summary:"Hire. Job Board Revamp", assignee:"priya", pod:"pod-a", module:"hire", type:"Revamp", size:"XXL", quarter:"q1-2026", startDate:"2026-01-06", loFiEnd:"2026-01-24", hiFiEnd:"2026-02-10", podReview:"2026-02-13", finalReview:"2026-02-18", status:"Done", scope:"IN", comments:"Large revamp. On time.", riskFlags:[], lastUpdated:"2026-02-18", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-02", summary:"Core Platform. Empty States Pattern", assignee:"arjun", pod:"pod-a", module:"design-system", type:"Pattern", size:"M", quarter:"q1-2026", startDate:"2026-01-06", loFiEnd:"2026-01-13", hiFiEnd:"2026-01-20", podReview:"2026-01-22", finalReview:"2026-01-27", status:"Done", scope:"IN", comments:"Published to DS.", riskFlags:[], lastUpdated:"2026-01-27", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-03", summary:"ESS. Benefits Enrollment UX", assignee:"rahul", pod:"pod-b", module:"ess", type:"New Feature", size:"XL", quarter:"q1-2026", startDate:"2026-01-06", loFiEnd:"2026-01-22", hiFiEnd:"2026-02-05", podReview:"2026-02-07", finalReview:"2026-02-12", status:"Done", scope:"IN", comments:"Complex multi-step form. Delivered.", riskFlags:[], lastUpdated:"2026-02-12", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-04", summary:"Learning. Home Feed Redesign", assignee:"sneha", pod:"pod-b", module:"learning", type:"Revamp", size:"L", quarter:"q1-2026", startDate:"2026-01-13", loFiEnd:"2026-01-22", hiFiEnd:"2026-01-31", podReview:"2026-02-03", finalReview:"2026-02-07", status:"Done", scope:"IN", comments:"Feature adopted by 60% of users.", riskFlags:[], lastUpdated:"2026-02-07", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-05", summary:"Analytics. Overview Dashboard v1", assignee:"priya", pod:"pod-a", module:"analytics", type:"New Feature", size:"XL", quarter:"q1-2026", startDate:"2026-02-10", loFiEnd:"2026-02-24", hiFiEnd:"2026-03-10", podReview:"2026-03-12", finalReview:"2026-03-17", status:"Done", scope:"IN", comments:"Flagship feature. Shipped to prod.", riskFlags:[], lastUpdated:"2026-03-17", dateChanges:[], aiUsage:"AI Assisted" },
  { key:"UX-Q1-06", summary:"Hire, Interview Feedback Form", assignee:"arjun", pod:"pod-a", module:"hire", type:"New Feature", size:"L", quarter:"q1-2026", startDate:"2026-02-03", loFiEnd:"2026-02-14", hiFiEnd:"2026-02-24", podReview:"2026-02-26", finalReview:"2026-03-03", status:"Done", scope:"IN", comments:"Shipped. 4.6★ rating from interviewers.", riskFlags:[], lastUpdated:"2026-03-03", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-07", summary:"Performance. Goal Templates UX", assignee:"sneha", pod:"pod-b", module:"performance", type:"New Feature", size:"M", quarter:"q1-2026", startDate:"2026-02-17", loFiEnd:"2026-02-24", hiFiEnd:"2026-03-04", podReview:"2026-03-06", finalReview:"2026-03-10", status:"Done", scope:"IN", comments:"Smooth execution.", riskFlags:[], lastUpdated:"2026-03-10", dateChanges:[], aiUsage:null },
  { key:"UX-Q1-08", summary:"Reports. Dashboard Scheduling UX", assignee:"rahul", pod:"pod-b", module:"reports", type:"New Feature", size:"L", quarter:"q1-2026", startDate:"2026-03-03", loFiEnd:"2026-03-12", hiFiEnd:"2026-03-21", podReview:"2026-03-24", finalReview:"2026-03-27", status:"Done", scope:"IN", comments:"Delivered end of quarter.", riskFlags:[], lastUpdated:"2026-03-27", dateChanges:[], aiUsage:null },

  /* ── Q4 2026 · UX_OND 26, the live quarter ────────────────────────────
     The team starts a quarter early, so work is already in flight before
     1 Oct. Deliberately spans every state the dashboard has to render:
     delivered, in review, in progress, not started, overdue, due-soon,
     drifted, blocked, missing PRD, unassigned, and mid-sprint scope adds. */
  {
    key:"UX-501", summary:"Payroll Run. Exception Handling Redesign",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"Revamp", size:"XL", quarter:"q4-2026",
    startDate:"2026-08-10", loFiEnd:"2026-08-24", hiFiEnd:"2026-09-07",
    podReview:"2026-09-11", finalReview:"2026-09-18",
    status:"In Progress", scope:"IN",
    comments:"Lo-fi signed off. Edge cases around retro-corrections still open with Payroll PM.",
    riskFlags:["due-soon"], lastUpdated:"2026-08-28",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-502", summary:"Benefits Enrolment. Guided Flow",
    assignee:"sneha", pod:"pod-b", module:"ess",
    type:"New Feature", size:"L", quarter:"q4-2026",
    startDate:"2026-08-03", loFiEnd:"2026-08-17", hiFiEnd:"2026-08-28",
    podReview:"2026-09-01", finalReview:"2026-09-08",
    status:"In Review", scope:"IN",
    comments:"Hi-fi in pod review. Two open comments on the dependants step.",
    riskFlags:[], lastUpdated:"2026-08-29",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-503", summary:"Manager Dashboard. Team Attendance Widget",
    assignee:"rahul", pod:"pod-b", module:"reports",
    type:"New Feature", size:"M", quarter:"q4-2026",
    startDate:"2026-07-27", loFiEnd:"2026-08-07", hiFiEnd:"2026-08-21",
    podReview:"2026-08-25", finalReview:"2026-08-28",
    status:"Done", scope:"IN",
    comments:"Shipped to staging. Handoff notes attached to the epic.",
    riskFlags:[], lastUpdated:"2026-08-28",
    dateChanges:[], aiUsage:"AI Led",
  },
  {
    key:"UX-504", summary:"Performance Reviews. Calibration Screen",
    assignee:"arjun", pod:"pod-a", module:"performance",
    type:"Revamp", size:"XXL", quarter:"q4-2026",
    startDate:"2026-08-05", loFiEnd:"2026-08-19", hiFiEnd:"2026-08-26",
    podReview:"2026-09-02", finalReview:"2026-09-09",
    status:"In Progress", scope:"IN",
    comments:"Scope grew after commitment, calibration matrix added late. Dates re-baselined once.",
    riskFlags:["date-drifted","scope-change","overdue"], lastUpdated:"2026-08-27",
    dateChanges:[
      { date:"2026-08-12", field:"hiFiEnd", from:"2026-08-14", to:"2026-08-26", reason:"Additional screens added to scope" },
    ], aiUsage:"AI Assisted",
  },
  {
    key:"UX-505", summary:"Learning Paths. Recommendation Rail",
    assignee:"priya", pod:"pod-a", module:"learning",
    type:"New Feature", size:"L", quarter:"q4-2026",
    startDate:"2026-08-17", loFiEnd:"2026-08-31", hiFiEnd:"2026-09-14",
    podReview:"2026-09-18", finalReview:"2026-09-25",
    status:"To Do", scope:"IN",
    comments:"PRD still pending with the Learning PM. Not started.",
    riskFlags:["missing-prd"], lastUpdated:"2026-08-20",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-506", summary:"Hiring, Interview Scorecard Template",
    assignee:"rahul", pod:"pod-b", module:"hire",
    type:"Pattern", size:"M", quarter:"q4-2026",
    startDate:"2026-08-06", loFiEnd:"2026-08-18", hiFiEnd:"2026-08-25",
    podReview:"2026-08-28", finalReview:"2026-09-03",
    status:"In Progress", scope:"IN",
    comments:"Blocked waiting on the ATS integration contract from engineering.",
    riskFlags:["blocker","overdue"], lastUpdated:"2026-08-21",
    dateChanges:[
      { date:"2026-08-19", field:"hiFiEnd", from:"2026-08-25", to:"2026-09-04", reason:"Blocked on engineering dependency" },
    ], aiUsage:null,
  },
  {
    key:"UX-507", summary:"Analytics. Attrition Insight Cards",
    assignee:"sneha", pod:"pod-b", module:"analytics",
    type:"New Feature", size:"L", quarter:"q4-2026",
    startDate:"2026-08-24", loFiEnd:"2026-09-07", hiFiEnd:"2026-09-21",
    podReview:"2026-09-25", finalReview:"2026-10-02",
    status:"In Progress", scope:"IN",
    comments:"Data science team ready. First concepts reviewed internally.",
    riskFlags:[], lastUpdated:"2026-08-30",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-508", summary:"Design System. Data Table v3",
    assignee:"arjun", pod:"pod-a", module:"design-system",
    type:"Pattern", size:"L", quarter:"q4-2026",
    startDate:"2026-08-11", loFiEnd:"2026-08-21", hiFiEnd:"2026-09-04",
    podReview:"2026-09-08", finalReview:"2026-09-15",
    status:"In Progress", scope:"IN",
    comments:"Sorting and column config patterns agreed. Density variants next.",
    riskFlags:["due-soon"], lastUpdated:"2026-08-29",
    dateChanges:[], aiUsage:"AI Led",
  },
  {
    key:"UX-509", summary:"Employee Self-Service. Mobile Leave Request",
    assignee:null, pod:"pod-b", module:"ess",
    type:"New Feature", size:"M", quarter:"q4-2026",
    startDate:"2026-09-01", loFiEnd:"2026-09-14", hiFiEnd:"2026-09-28",
    podReview:"2026-10-02", finalReview:"2026-10-09",
    status:"To Do", scope:"IN",
    comments:"Unassigned, depends on who frees up after the Payroll revamp.",
    riskFlags:["missing-prd"], lastUpdated:"2026-08-18",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-510", summary:"Reports Module. Scheduled Export UX",
    assignee:"rahul", pod:"pod-b", module:"reports",
    type:"UX Signoff", size:"S", quarter:"q4-2026",
    startDate:"2026-08-18", loFiEnd:"2026-08-25", hiFiEnd:"2026-08-29",
    podReview:"2026-09-01", finalReview:"2026-09-04",
    status:"In Review", scope:"IN",
    comments:"Waiting on final signoff from the Reports PM since the 26th.",
    riskFlags:["no-update"], lastUpdated:"2026-08-22",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-511", summary:"Core Platform. Global Search Scoping",
    assignee:"priya", pod:"pod-a", module:"core-platform",
    type:"Research", size:"M", quarter:"q4-2026",
    startDate:"2026-08-25", loFiEnd:"2026-09-08", hiFiEnd:"2026-09-18",
    podReview:"2026-09-22", finalReview:"2026-09-29",
    status:"In Progress", scope:"IN",
    comments:"Six client interviews booked. Synthesis in the first week of September.",
    riskFlags:[], lastUpdated:"2026-08-30",
    dateChanges:[], aiUsage:"AI Assisted",
  },
  {
    key:"UX-512", summary:"Onboarding. Document Checklist Revamp",
    assignee:"sneha", pod:"pod-b", module:"ess",
    type:"Revamp", size:"M", quarter:"q4-2026",
    startDate:"2026-08-13", loFiEnd:"2026-08-22", hiFiEnd:"2026-09-02",
    podReview:"2026-09-05", finalReview:"2026-09-12",
    status:"In Progress", scope:"IN",
    comments:"Added mid-sprint after a client escalation. Absorbed without moving other dates.",
    riskFlags:["scope-change"], lastUpdated:"2026-08-29",
    dateChanges:[], aiUsage:null, addedMidSprint:true,
  },
  {
    key:"UX-513", summary:"Performance. Goal Cascade Visualisation",
    assignee:"arjun", pod:"pod-a", module:"performance",
    type:"New Feature", size:"L", quarter:"q4-2026",
    startDate:"2026-08-20", loFiEnd:"2026-09-03", hiFiEnd:"2026-09-17",
    podReview:"2026-09-21", finalReview:"2026-09-28",
    status:"To Do", scope:"IN",
    comments:"Queued behind the calibration screen. Starts once UX-504 clears review.",
    riskFlags:[], lastUpdated:"2026-08-26",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-514", summary:"Hire. Offer Letter Builder",
    assignee:"rahul", pod:"pod-b", module:"hire",
    type:"New Feature", size:"XL", quarter:"q4-2026",
    startDate:"2026-07-30", loFiEnd:"2026-08-13", hiFiEnd:"2026-08-20",
    podReview:"2026-08-24", finalReview:"2026-08-31",
    status:"In Progress", scope:"IN",
    comments:"Legal review of the template language pushed twice. Design is done and waiting.",
    riskFlags:["date-drifted","overdue","blocker"], lastUpdated:"2026-08-25",
    dateChanges:[
      { date:"2026-08-10", field:"finalReview", from:"2026-08-24", to:"2026-08-31", reason:"Waiting on legal approval" },
      { date:"2026-08-24", field:"finalReview", from:"2026-08-31", to:"2026-09-11", reason:"Legal still pending" },
    ], aiUsage:"AI Assisted",
  },
  {
    key:"UX-515", summary:"Analytics. Headcount Forecast Chart",
    assignee:"priya", pod:"pod-a", module:"analytics",
    type:"Pattern", size:"S", quarter:"q4-2026",
    startDate:"2026-08-04", loFiEnd:"2026-08-11", hiFiEnd:"2026-08-18",
    podReview:"2026-08-20", finalReview:"2026-08-24",
    status:"Done", scope:"IN",
    comments:"Reused the Data Table v3 tokens. Shipped ahead of the committed date.",
    riskFlags:[], lastUpdated:"2026-08-24",
    dateChanges:[], aiUsage:"AI Led",
  },
  {
    key:"UX-516", summary:"Learning. Course Card Accessibility Pass",
    assignee:"sneha", pod:"pod-b", module:"learning",
    type:"UX Signoff", size:"S", quarter:"q4-2026",
    startDate:"2026-08-26", loFiEnd:"2026-09-02", hiFiEnd:"2026-09-09",
    podReview:"2026-09-11", finalReview:"2026-09-16",
    status:"To Do", scope:"IN",
    comments:"Contrast and focus-order audit. Small but blocks the accessibility signoff.",
    riskFlags:[], lastUpdated:"2026-08-27",
    dateChanges:[], aiUsage:null,
  },
  {
    key:"UX-517", summary:"Core Platform. Notification Digest Settings",
    assignee:"arjun", pod:"pod-a", module:"core-platform",
    type:"New Feature", size:"M", quarter:"q4-2026",
    startDate:"2026-09-07", loFiEnd:"2026-09-18", hiFiEnd:"2026-10-02",
    podReview:"2026-10-06", finalReview:"2026-10-13",
    status:"To Do", scope:"OUT",
    comments:"De-scoped from Q4 at cutline, moved to next quarter's pipeline.",
    riskFlags:[], lastUpdated:"2026-08-19",
    dateChanges:[], aiUsage:null,
  },
];

// ══════════════════════════════════════════════════════════════
//  Q4 2026. Planning Backlog (PMs have added; being evaluated)
//  Phase: Cutline  |  Assignments being decided
// ══════════════════════════════════════════════════════════════

const PLANNING_TICKETS = [
  {
    key:"UX-P001", summary:"AI-Powered Resume Parser. UX Design",
    pod:"pod-a", module:"hire", type:"New Feature", size:"XL",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"priya",
    addedBy:"Ravi Kumar (PM)", addedOn:"2026-07-10",
    comments:"High-priority initiative from leadership. Must ship Q4.",
    pmNotes:"PRD approved. Dependencies on ML team API.",
  },
  {
    key:"UX-P002", summary:"Payroll Module v2. Full UX Revamp",
    pod:"pod-a", module:"core-platform", type:"Revamp", size:"XXL",
    cutline:"TBD", prdReady:false,
    tentativeAssignee:"arjun",
    addedBy:"Asha Menon (PM)", addedOn:"2026-07-08",
    comments:"PRD still being written. Scope unclear. Risk of landing in Q5.",
    pmNotes:"Stakeholder alignment pending.",
  },
  {
    key:"UX-P003", summary:"Predictive Analytics, Insight Cards Feature",
    pod:"pod-a", module:"analytics", type:"New Feature", size:"XXL",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"arjun",
    addedBy:"Ravi Kumar (PM)", addedOn:"2026-07-11",
    comments:"Data science team ready. UX needed for Q4 kick-off.",
    pmNotes:"PRD v1 attached.",
  },
  {
    key:"UX-P004", summary:"Design Token System v2. Theming Engine",
    pod:"pod-a", module:"design-system", type:"Pattern", size:"L",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"arjun",
    addedBy:"Kiran Desai (Pod A Manager)", addedOn:"2026-07-09",
    comments:"DS initiative. Well scoped.",
    pmNotes:"Agreed in Q3 retro.",
  },
  {
    key:"UX-P005", summary:"Skills Assessment Center. New Feature",
    pod:"pod-b", module:"ess", type:"New Feature", size:"XL",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"sneha",
    addedBy:"Preethi Nair (PM)", addedOn:"2026-07-07",
    comments:"HR priority. Sneha has capacity from Q3.",
    pmNotes:"Approved by VP HR.",
  },
  {
    key:"UX-P006", summary:"Mobile App. Bottom Nav Global Revamp",
    pod:"pod-a", module:"core-platform", type:"Revamp", size:"L",
    cutline:"TBD", prdReady:false,
    tentativeAssignee:null,
    addedBy:"Asha Menon (PM)", addedOn:"2026-07-12",
    comments:"Depends on Mobile v2 strategy decision. May not make cutline.",
    pmNotes:"Strategy meeting on Jul 21.",
  },
  {
    key:"UX-P007", summary:"Learning Path Recommendations. Research",
    pod:"pod-b", module:"learning", type:"Research", size:"M",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"rahul",
    addedBy:"Preethi Nair (PM)", addedOn:"2026-07-05",
    comments:"Quick research sprint. Rahul is best fit given learning module ownership.",
    pmNotes:"3 user interviews planned.",
  },
  {
    key:"UX-P008", summary:"Performance Review 2.0. Full Redesign",
    pod:"pod-b", module:"performance", type:"Revamp", size:"XL",
    cutline:"IN", prdReady:true,
    tentativeAssignee:"sneha",
    addedBy:"Meera Pillai (Pod B Manager)", addedOn:"2026-07-10",
    comments:"Sneha owns performance module. Good fit.",
    pmNotes:"Q4 roadmap anchor ticket.",
  },
  {
    key:"UX-P009", summary:"Reports. Export & Scheduling Center v2",
    pod:"pod-b", module:"reports", type:"New Feature", size:"M",
    cutline:"OUT", prdReady:false,
    tentativeAssignee:null,
    addedBy:"Preethi Nair (PM)", addedOn:"2026-07-13",
    comments:"Moved OUT. Existing reports sufficient for Q4.",
    pmNotes:"Revisit Q1 2026.",
  },
  {
    key:"UX-P010", summary:"Org Chart, Interactive Tree Visualization",
    pod:"pod-b", module:"ess", type:"New Feature", size:"XXL",
    cutline:"TBD", prdReady:false,
    tentativeAssignee:null,
    addedBy:"Preethi Nair (PM)", addedOn:"2026-07-11",
    comments:"Ambitious. Needs D3 expertise. No designer assigned yet.",
    pmNotes:"Feasibility check needed from tech.",
  },
];

// ── Weekly Digest (current week data) ────────────────────────
const WEEKLY = {
  weekLabel:"Week of Jul 14 – Jul 18, 2026",
  planned:[
    { key:"UX-101", summary:"Checkout Flow Revamp",      assignee:"priya", pod:"pod-a", module:"core-platform", status:"Done" },
    { key:"UX-201", summary:"Button Component v2",       assignee:"arjun", pod:"pod-a", module:"design-system", status:"Done" },
    { key:"UX-301", summary:"Job Posting Form Revamp",   assignee:"rahul", pod:"pod-b", module:"hire",          status:"Done" },
    { key:"UX-401", summary:"Course Cards New Design",   assignee:"sneha", pod:"pod-b", module:"learning",      status:"Done" },
    { key:"UX-204", summary:"Profile Settings Signoff",  assignee:"arjun", pod:"pod-a", module:"core-platform", status:"Done" },
    { key:"UX-303", summary:"Reports Module Signoff",    assignee:"rahul", pod:"pod-b", module:"reports",       status:"In Progress", missedReason:"Status not updated, still In Progress at week close" },
  ],
  delivered:["UX-101","UX-201","UX-301","UX-401","UX-204"],
  missed:["UX-303"],
  carryForward:[
    { key:"UX-102", summary:"Onboarding Wizard Research",  assignee:"priya", pod:"pod-a", module:"core-platform", status:"In Progress" },
    { key:"UX-202", summary:"Mobile Navigation Pattern",   assignee:"arjun", pod:"pod-a", module:"design-system", status:"In Progress" },
    { key:"UX-302", summary:"Candidate Pipeline Kanban",   assignee:"rahul", pod:"pod-b", module:"hire",          status:"In Progress" },
  ],
  atRisk:[
    { key:"UX-102", summary:"Onboarding Wizard Research", assignee:"priya", pod:"pod-a", module:"core-platform", flag:"No stakeholder sign-off yet" },
    { key:"UX-302", summary:"Candidate Pipeline Kanban",  assignee:"rahul", pod:"pod-b", module:"hire",          flag:"Awaiting stakeholder review on interaction states" },
  ],
  nextWeek:[
    { key:"UX-104", summary:"Dashboard Empty States",      assignee:"priya", pod:"pod-a", module:"core-platform", flag:null },
    { key:"UX-203", summary:"Icon Library Audit",          assignee:"arjun", pod:"pod-a", module:"design-system", flag:"No PRD yet" },
    { key:"UX-304", summary:"Interview Scheduling Flow",   assignee:"rahul", pod:"pod-b", module:"hire",          flag:null },
    { key:"UX-402", summary:"Quiz Builder Redesign",       assignee:"sneha", pod:"pod-b", module:"learning",      flag:"Scope unclear, needs PM clarification" },
    { key:"UX-105", summary:"Notification Centre v2",      assignee:"priya", pod:"pod-a", module:"core-platform", flag:null },
  ],
};
