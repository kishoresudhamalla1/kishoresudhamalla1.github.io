import { lazy, type ComponentType, type LazyExoticComponent } from "react";

export type ClusterId = "understanding" | "acting" | "trusting";

export interface DemoMeta {
  slug: string;
  n: string;
  title: string;
  cluster: ClusterId;
  /** one or two lines: what this solves */
  strap: string;
  /** competitive literacy: the real products this pattern is drawn from */
  inspired: string;
  notes: { decision: string; tradeoff: string; doneWell: string };
  Demo: LazyExoticComponent<ComponentType>;
}

export const CLUSTERS: { id: ClusterId; label: string; blurb: string }[] = [
  { id: "understanding", label: "Understanding", blurb: "Before the agent acts" },
  { id: "acting", label: "Acting", blurb: "While the agent works" },
  { id: "trusting", label: "Trusting and recovering", blurb: "After, and when it goes wrong" },
];

export const DEMOS: DemoMeta[] = [
  {
    slug: "01-intent-understanding",
    n: "01",
    title: "Intent understanding",
    cluster: "understanding",
    strap: "Most agent failures start before the agent acts, at the moment it decided what you meant.",
    inspired: "Pattern seen in Microsoft’s HAX Toolkit (disambiguate before acting) and ChatGPT’s partial-fulfilment replies",
    notes: {
      decision: "The ask-versus-proceed threshold is the design artifact here, not the chat bubble. Slide it and the same request changes behaviour.",
      tradeoff: "Every clarifying turn costs flow, so ask at most one question and make it answerable in a tap. When confidence is high the agent skips it, and the skip is shown so it reads as deliberate rather than lazy.",
      doneWell: "HAX Toolkit codifies disambiguating before acting. ChatGPT states a limit in one line and then offers the closest adjacent help.",
    },
    Demo: lazy(() => import("./01-intent-understanding")),
  },
  {
    slug: "02-plan-decomposition",
    n: "02",
    title: "Plan and task decomposition",
    cluster: "understanding",
    strap: "Autonomy across many steps needs oversight, so the plan itself becomes the review surface.",
    inspired: "Pattern seen in Devin and the GitHub Copilot coding agent",
    notes: {
      decision: "Each step has its own status machine, so one stalled or failed step is visible without freezing the whole plan.",
      tradeoff: "Letting people edit the plan before it runs costs a moment but is cheaper than undoing a wrong run. Re-planning live, instead of restarting, keeps the person’s mental model intact.",
      doneWell: "Devin shows an explicit planner step and re-plans in view. The Copilot coding agent keeps its plan as a checklist in the pull request and ticks it off.",
    },
    Demo: lazy(() => import("./02-plan-decomposition")),
  },
  {
    slug: "03-tool-orchestration",
    n: "03",
    title: "Tool use and orchestration",
    cluster: "acting",
    strap: "Make invisible tool calls legible without burying the answer under them.",
    inspired: "Pattern seen in Perplexity and Manus",
    notes: {
      decision: "Collapse the process into a one line summary by default and keep full detail one click away.",
      tradeoff: "Raw tool logs as the default view overwhelm most people. Hiding detail entirely removes the audit path. Detail on demand serves both.",
      doneWell: "Perplexity lists steps while it works and then collapses them. Manus names the current step and keeps an honest elapsed time next to the composer.",
    },
    Demo: lazy(() => import("./03-tool-orchestration")),
  },
  {
    slug: "04-autonomy-approval",
    n: "04",
    title: "Autonomy and approval",
    cluster: "acting",
    strap: "Too many gates and it feels broken. Too few and people get nervous.",
    inspired: "Pattern seen in Cursor’s tiered permissions",
    notes: {
      decision: "Permission is tied to the risk of each action, not to one global switch. Reading, reversible writes and irreversible sends are different things.",
      tradeoff: "Per-action trust is more to design and explain. In return, permission can decay toward autonomy as a specific action type proves safe.",
      doneWell: "Cursor runs an allowlist instantly, sandboxes some calls and sends the rest to a policy check, configurable per team. Its manual mode gates every write on an explicit accept.",
    },
    Demo: lazy(() => import("./04-autonomy-approval")),
  },
  {
    slug: "05-execution-states",
    n: "05",
    title: "Live execution states",
    cluster: "acting",
    strap: "An agent that goes silent for ten seconds reads as broken even when it is working.",
    inspired: "Pattern seen in production agent SDK status models",
    notes: {
      decision: "Waiting on you is louder than thinking, in shape and motion as well as colour. It must never look like progress.",
      tradeoff: "A louder waiting state costs some calm. A stalled approval that looks like work in progress costs trust.",
      doneWell: "Agent SDKs reduce status to working, waiting and done, driven by the underlying call state. Every run should end in a result, a retry or an explanation.",
    },
    Demo: lazy(() => import("./05-execution-states")),
  },
  {
    slug: "12-multi-agent-coordination",
    n: "06",
    title: "Multi-agent coordination",
    cluster: "acting",
    strap: "Designing for a system of agents, not for one chat window.",
    inspired: "Pattern seen in supervisor and orchestrator systems and in OrchVis research on human oversight",
    notes: {
      decision: "Disagreement between specialists is surfaced and reconciled in view. Each claim in the final answer stays attributed to the agent that produced it.",
      tradeoff: "Showing a conflict is less tidy than one confident answer. A hidden conflict is a wrong answer, or a supervisor paraphrasing a number incorrectly on the way back.",
      doneWell: "Supervisor systems delegate to narrow specialists. OrchVis argues for layered views of goals, per goal progress and a conflict resolution surface.",
    },
    Demo: lazy(() => import("./12-multi-agent-coordination")),
  },
  {
    slug: "13-meaningful-thinking-steps",
    n: "07",
    title: "Meaningful thinking steps",
    cluster: "acting",
    strap: "An answer that takes 8 to 12 seconds needs real status, not a progress bar wearing words.",
    inspired: "Pattern seen in agent SDKs that surface named tool calls instead of a generic spinner",
    notes: {
      decision: "Every step label names a call the system is actually making. If the question changed, the steps shown would change with it.",
      tradeoff: "Naming real steps is more to instrument than a decorative loader. The payoff is that a ten second wait reads as work, not as a stall dressed up to look patient.",
      doneWell: "Toggle between the two in the demo: identical timing and step count, and only one of them would still make sense if the question changed.",
    },
    Demo: lazy(() => import("./13-meaningful-thinking-steps")),
  },
  {
    slug: "16-connector-consent",
    n: "08",
    title: "Connector and tool consent",
    cluster: "acting",
    strap: "Granting an agent access to a tool is a different decision from approving one action, and it needs its own screen.",
    inspired: "Pattern seen in Cloudscape's user-authorized-actions guidance and Gravitee's progressive-consent guidance for MCP tools",
    notes: {
      decision: "A grant has a scope and a duration, shown together. A tool whose required access grows has to ask again, in the same shape as the first request, rather than quietly inheriting more.",
      tradeoff: "Scoped, revocable grants are more screens than one blanket \"allow this app\" toggle. In return, what an agent can touch is always answerable from one inventory instead of trusted from memory.",
      doneWell: "Cloudscape ties the length of a grant to an explicit scope selector. Gravitee argues an upstream permission change should force re-approval instead of expanding a grant silently.",
    },
    Demo: lazy(() => import("./16-connector-consent")),
  },
  {
    slug: "17-background-agents",
    n: "09",
    title: "Background agents",
    cluster: "acting",
    strap: "A task that only works while you watch it isn't actually autonomous.",
    inspired: "Pattern seen in GitHub Copilot's coding agent, OpenAI Codex cloud tasks and Devin, which keep running after you close the tab",
    notes: {
      decision: "Leaving doesn't pause the run. What changes is only the surface: a persistent status chip while you're away, a distinct \"finished while you were away\" framing on return, never the same silent completion as watching it live.",
      tradeoff: "A separate away state and return notice are more to build than one progress view that assumes a captive audience. Without it, a real async run either forces someone to wait who didn't need to, or finishes with no sign it ever happened.",
      doneWell: "Copilot's coding agent and Devin both run unattended and surface a notification and a diff on return, not a transcript you had to be present for.",
    },
    Demo: lazy(() => import("./17-background-agents")),
  },
  {
    slug: "22-autonomy-budgets",
    n: "10",
    title: "Autonomy budgets",
    cluster: "acting",
    strap: "An unattended run needs its own edge, not just a person's patience, to stop at.",
    inspired: "Pattern seen in Claude Code and Devin, which cap a long-running or background task by actions taken or time spent and check back in before going further",
    notes: {
      decision: "The budget is shown as two numbers the whole time it runs, actions used and time left, not hidden until it's spent. Hitting either one stops the run and asks for more, the same shape as any other approval, rather than failing silently or running forever.",
      tradeoff: "A visible budget is one more thing to explain up front, next to a plan or an approval tier. Without it, \"unattended\" quietly means \"unbounded\", and the only backstop is someone noticing and cancelling the run by hand.",
      doneWell: "Claude Code and Devin both run long tasks against an explicit cap and pause for a check-in at the edge of it, instead of assuming a person is watching the whole time.",
    },
    Demo: lazy(() => import("./22-autonomy-budgets")),
  },
  {
    slug: "18-subagent-delegation",
    n: "11",
    title: "Sub-agent delegation",
    cluster: "acting",
    strap: "Delegating a piece of the work is not the same shape as a persistent team of named specialists.",
    inspired: "Pattern seen in Claude Code's Task tool, which spins up short-lived sub-agents for a single piece of work and folds the result back into one thread",
    notes: {
      decision: "Each sub-agent is its own small run with its own steps, collapsed to one result line once it finishes. Nothing about it is named or persistent, because it doesn't need to be asked anything again.",
      tradeoff: "A fully expandable nested trace is more interface than a flat tool-call list. It's what makes the final answer auditable back to which sub-agent produced which fact, instead of one undifferentiated block of work.",
      doneWell: "Claude Code's Task tool delegates a bounded piece of work to an ephemeral agent and returns just its result to the parent thread, which is exactly the shape this demo plays back.",
    },
    Demo: lazy(() => import("./18-subagent-delegation")),
  },
  {
    slug: "19-async-notifications",
    n: "12",
    title: "Async notifications",
    cluster: "acting",
    strap: "A finished run that only shows up if you happen to be looking isn't actually asynchronous.",
    inspired: "Pattern seen in ChatGPT Tasks and Gemini Scheduled Actions (per-channel delivery, a management list separate from chat) and \"async agents: inbox, not chat\" design writing on batching completions",
    notes: {
      decision: "Multiple runs that finish close together batch into one digest instead of one interruption each, and a failure sits inside the same list as a success rather than a separate alert.",
      tradeoff: "Batching delays an individual notification by however long the digest window is. In return, three things finishing while you were away reads as one update to open, not three separate pings to dismiss.",
      doneWell: "ChatGPT Tasks and Gemini Scheduled Actions both let a person choose push, email or in-app per task rather than one global switch, and keep a management list separate from the conversation that produced each run.",
    },
    Demo: lazy(() => import("./19-async-notifications")),
  },
  {
    slug: "20-message-branching",
    n: "13",
    title: "Message editing and branching",
    cluster: "acting",
    strap: "Editing something you already sent should fork the conversation, not erase what it already produced.",
    inspired: "Pattern seen in assistant-ui's edit and branch primitives and Trigger.dev's branching model, where a regenerate is a new sibling reply, not a replacement",
    notes: {
      decision: "An edited message and a regenerated reply are both new siblings under the thing they revise, never an overwrite. Each gets its own small pager instead of a confirm dialog asking to discard the old one.",
      tradeoff: "Keeping every version means the thread holds more state than a single linear log. It's what makes \"what did I actually ask the first time\" answerable instead of gone the moment someone hits send again.",
      doneWell: "assistant-ui treats an edit and a regenerate as the same operation, a new branch, with a picker to move between alternatives. Trigger.dev's model makes that explicit: regenerate creates a new assistant sibling of the original reply.",
    },
    Demo: lazy(() => import("./20-message-branching")),
  },
  {
    slug: "21-latency-trust",
    n: "14",
    title: "Latency and trust",
    cluster: "acting",
    strap: "The same wait reads as broken, tolerable or fine, depending only on what fills it.",
    inspired: "Pattern seen in Nielsen Norman Group's response-time thresholds (0.1s, 1s and 10s) and agent SDKs that swap a spinner for named steps as a wait gets longer",
    notes: {
      decision: "The feedback shown isn't a design choice made once. It's a function of the wait itself: nothing under a second, a spinner up to four, named steps past that, and an explicit reassurance once a person's attention would otherwise have left.",
      tradeoff: "Four feedback shapes are more to build and maintain than one spinner for every wait. A spinner on a one second answer is noise, and silence on a twelve second one reads as broken, so one shape for every duration was never actually simpler.",
      doneWell: "NN/g's thresholds (0.1s, 1s, 10s) are the oldest result in this space and still hold. Modern agent SDKs apply the same idea by naming the call in progress once a wait gets long enough to need it.",
    },
    Demo: lazy(() => import("./21-latency-trust")),
  },
  {
    slug: "06-editable-outputs",
    n: "15",
    title: "Editable outputs",
    cluster: "trusting",
    strap: "AI output is a draft to work on together, not an answer to accept or discard.",
    inspired: "Pattern seen in ChatGPT Canvas and Notion AI",
    notes: {
      decision: "This uses the dual pane shape with section-level edits that re-render only what changed. The inline shape is also legitimate, so it is a choice and not a rule.",
      tradeoff: "Scoped edits are more to build than regenerating a document. They preserve everything the person did not touch, and every change is versioned.",
      doneWell: "Canvas opens a persistent panel, offers inline edit actions on a selection and keeps history. Notion scopes AI editing to selected text inside the document.",
    },
    Demo: lazy(() => import("./06-editable-outputs")),
  },
  {
    slug: "07-transparency-provenance",
    n: "16",
    title: "Transparency and provenance",
    cluster: "trusting",
    strap: "Cited answers get believed and uncited answers get second guessed.",
    inspired: "Pattern seen in Perplexity",
    notes: {
      decision: "Each layer of provenance answers a different depth of skepticism, so nothing dumps everything on everyone at once.",
      tradeoff: "Layers add surface to maintain. One dense citation block either overwhelms or hides. Confidence is a band, never a made-up percentage, and a low band always carries a way to verify.",
      doneWell: "Perplexity layers inline citations, a process summary, a sources row, a full audit, a check scoped to a selection and a wrong-sources path.",
    },
    Demo: lazy(() => import("./07-transparency-provenance")),
  },
  {
    slug: "08-failure-recovery",
    n: "17",
    title: "Failure and recovery",
    cluster: "trusting",
    strap: "Most portfolios show the happy path. This shows what happens when it breaks.",
    inspired: "Pattern seen in Lovable (fix forward) and Cursor (roll back)",
    notes: {
      decision: "Every error answers two questions before anything technical: what broke and is my work safe.",
      tradeoff: "Fixing forward is fast but can compound a mistake. Rolling back is safe but discards progress. Partial completion is the most common outcome and the least designed, so retry only touches what failed.",
      doneWell: "Lovable offers a fix action that reads the error log. Cursor checkpoints each agent edit and restores files while keeping the whole conversation.",
    },
    Demo: lazy(() => import("./08-failure-recovery")),
  },
  {
    slug: "09-human-handoff",
    n: "18",
    title: "Human handoff",
    cluster: "trusting",
    strap: "The seam between AI and a person should be a relay, not a reset.",
    inspired: "Pattern seen in Intercom’s Fin",
    notes: {
      decision: "The person receiving the conversation works from the same record, so nothing the customer already said is lost.",
      tradeoff: "Carrying full context makes a handoff heavier to build. A reset is cheaper and makes the customer repeat everything.",
      doneWell: "Fin keeps the AI and the human agent on one conversation record and lets teams configure whether it offers or triggers escalation.",
    },
    Demo: lazy(() => import("./09-human-handoff")),
  },
  {
    slug: "10-memory-personalization",
    n: "19",
    title: "Memory and personalization",
    cluster: "trusting",
    strap: "Persistent memory is a trust surface, not a feature flag.",
    inspired: "Pattern seen in ChatGPT’s memory controls",
    notes: {
      decision: "Declared and inferred memories are different objects with different remedies. A wrong inference needs “stop assuming”. A wrong fact just needs deleting.",
      tradeoff: "Two remedies add interface. Conflating them erodes trust faster than having no memory at all, so the extra surface is worth it.",
      doneWell: "ChatGPT shows memory as a searchable list a person can review, edit or delete, which makes its influence inspectable.",
    },
    Demo: lazy(() => import("./10-memory-personalization")),
  },
  {
    slug: "11-evaluation-observability",
    n: "20",
    title: "Evaluation and observability",
    cluster: "trusting",
    strap: "The part almost nobody designs: how teams ship and maintain agent quality.",
    inspired: "Pattern seen in LangSmith",
    notes: {
      decision: "A run is a tree of steps, so a failure is isolated to the step that caused it instead of being debugged as a black box.",
      tradeoff: "Trace detail is dense, so rows are expandable and the failing step opens for you. The eval table has to be scannable across many examples at once.",
      doneWell: "LangSmith decomposes each run into inspectable steps with input, output, latency and cost, and scores runs against saved datasets.",
    },
    Demo: lazy(() => import("./11-evaluation-observability")),
  },
  {
    slug: "14-incomplete-responses",
    n: "21",
    title: "Incomplete responses",
    cluster: "trusting",
    strap: "Failure is the easy case to design for. Most incomplete answers aren't failures at all.",
    inspired: "Pattern seen in enterprise HR assistants that separate partial answers, clarification, retry and escalation as distinct states",
    notes: {
      decision: "Four incomplete states, not one: a partial answer with the gap named, a single clarifying question, a transparent retry, and an escalation that always routes to a person regardless of confidence.",
      tradeoff: "Four states are more to design than one generic error screen. Collapsing them back into \"something went wrong\" would hide which of them is actually true, and each implies a different next action.",
      doneWell: "The retry step shows the failed attempt instead of hiding it, and the escalation names the specific person it went to rather than a queue, so the handoff reads as someone getting it, not a ticket disappearing.",
    },
    Demo: lazy(() => import("./14-incomplete-responses")),
  },
  {
    slug: "15-accuracy-communication",
    n: "22",
    title: "Communicating accuracy",
    cluster: "trusting",
    strap: "A blanket low-confidence disclaimer erodes trust in the answers that deserved it least.",
    inspired: "Pattern seen in enterprise assistants that tie confidence to the source of a claim rather than to the model",
    notes: {
      decision: "Confidence is attached to where an answer came from, a live record, a document that can go stale, or a calculation, not stated as one number for the whole system.",
      tradeoff: "Per-source confidence is more to maintain than one disclaimer at the bottom of every reply. It means a system-record answer can read as certain, which a single blanket caveat would never allow.",
      doneWell: "Payroll, benefits and compliance questions route to a mandatory human-confirmation gate regardless of how confident the estimate reads, because some categories of error are too costly to leave to a confidence score.",
    },
    Demo: lazy(() => import("./15-accuracy-communication")),
  },
];

export const bySlug = (s: string) => DEMOS.find((d) => d.slug === s);
