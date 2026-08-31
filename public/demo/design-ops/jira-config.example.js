// ============================================================
//  Jira Sync. Configuration
//  Template. Copy to jira-config.js and fill in your values.
//  jira-config.js is gitignored: it is served from public/, so a real
//  API token pasted into it would be published with the site.
// ============================================================

module.exports = {

  // Your Jira Cloud base URL (no trailing slash)
  baseUrl: "https://your-org.atlassian.net",

  // Jira project key (e.g. "UX" if your tickets are UX-101)
  projectKey: "UX",

  // Generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens
  // Use your Jira login email below
  email: "you@your-org.com",
  apiToken: "YOUR_API_TOKEN_HERE",

  // ── Custom field IDs ──────────────────────────────────────
  // Ask your Jira admin or find via:
  //   GET /rest/api/3/field  → look for your custom field names
  fields: {
    storyPoints:  "customfield_10016",  // Story Points (default in most Jira Cloud)
    tshirtSize:   "customfield_10020",  // Custom T-shirt size field (if you have one)
    pod:          "customfield_10030",  // Pod assignment custom field
    loFiDate:     "customfield_10031",  // Lo-Fi completion date
    hiFiDate:     "customfield_10032",  // Hi-Fi completion date
    podReview:    "customfield_10033",  // Pod Review date
    finalReview:  "customfield_10034",  // Final Review date
    aiUsage:      "customfield_10035",  // AI Usage field (or use labels, see below)
  },

  // If you use Jira LABELS instead of custom fields for pod/AI usage:
  // pod is derived from label "pod-a" or "pod-b"
  // AI usage is derived from label "AI-Assisted" or "AI-Led"
  useLabelForPod:     true,
  useLabelForAI:      true,

  // ── Designer → Jira accountId mapping ────────────────────
  // Find accountIds via GET /rest/api/3/user/search?query=name
  designers: [
    { id: "priya", name: "Priya Sharma",  initials: "PS", color: "#6366f1", pod: "pod-a", jiraAccountId: "REPLACE_WITH_ACCOUNT_ID" },
    { id: "arjun", name: "Arjun Mehta",   initials: "AM", color: "#8b5cf6", pod: "pod-a", jiraAccountId: "REPLACE_WITH_ACCOUNT_ID" },
    { id: "rahul", name: "Rahul Nair",    initials: "RN", color: "#ec4899", pod: "pod-b", jiraAccountId: "REPLACE_WITH_ACCOUNT_ID" },
    { id: "sneha", name: "Sneha Rao",     initials: "SR", color: "#f59e0b", pod: "pod-b", jiraAccountId: "REPLACE_WITH_ACCOUNT_ID" },
  ],

  // ── T-shirt size mapping (story points → size) ───────────
  // Adjust breakpoints to match your team's pointing scale
  sizeFromPoints: (pts) => {
    if (!pts) return "M";
    if (pts <= 1)  return "S";
    if (pts <= 3)  return "M";
    if (pts <= 5)  return "L";
    if (pts <= 10) return "XL";
    return "XXL";
  },

  // ── Status mapping (Jira status → dashboard status) ──────
  statusMap: {
    "To Do":       "To Do",
    "In Progress": "In Progress",
    "In Review":   "In Review",
    "Done":        "Done",
    // Add your custom statuses here:
    // "Pod Review":  "In Review",
    // "Shipped":     "Done",
  },
};
