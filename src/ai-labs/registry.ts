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
    slug: "06-editable-outputs",
    n: "07",
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
    n: "08",
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
    n: "09",
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
    n: "10",
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
    n: "11",
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
    n: "12",
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
];

export const bySlug = (s: string) => DEMOS.find((d) => d.slug === s);
