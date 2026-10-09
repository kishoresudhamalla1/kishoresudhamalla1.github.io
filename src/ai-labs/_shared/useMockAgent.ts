/**
 * Mock agent harness.
 *
 * One small simulation shared by every AI Labs demo, so they behave like one
 * system. It does not call a model. It plays a scripted list of steps with
 * real delays (a step takes 300ms to a few seconds) so loading, thinking and
 * waiting states are observable instead of flashed.
 *
 *   step      id, label, kind, duration, outcome (success | partial | error)
 *   run       queued -> running -> (waiting on a human) -> done | failed
 *   control   pause, resume, cancel, retry, skip, insert, remove, move
 *
 * Time is advanced by a 50ms tick rather than by chained timeouts, which is
 * what makes pausing, inserting a step mid-run and replaying at a slower
 * "p95" speed all fall out of the same loop.
 */
import { useEffect, useRef, useState } from "react";

export type StepKind = "search" | "read" | "write" | "call-tool" | "wait-approval" | "wait";
export type Outcome = "success" | "partial" | "error";
export type StepStatus = "pending" | "active" | "done" | "failed" | "blocked" | "skipped" | "waiting";
export type RunStatus =
  | "idle"
  | "queued"
  | "running"
  | "waiting"
  | "paused"
  | "done"
  | "failed"
  | "cancelled";

export interface StepDef {
  id: string;
  label: string;
  kind: StepKind;
  /** milliseconds at 1x speed */
  duration: number;
  outcome?: Outcome;
  /** outcome on a retry (defaults to success), so a failure can be recovered */
  retryOutcome?: Outcome;
  input?: Record<string, string>;
  output?: Record<string, string>;
  error?: string;
  /** nested tool calls shown while the parent runs */
  children?: { label: string; kind: StepKind }[];
  note?: string;
}

export interface StepState extends StepDef {
  status: StepStatus;
  elapsed: number;
  attempts: number;
  /** true for a step that was just inserted, so the UI can animate it in */
  fresh?: boolean;
  partial?: boolean;
  declined?: boolean;
}

export interface LogEntry {
  t: number;
  text: string;
  kind: "auto" | "human" | "system" | "error";
  stepId?: string;
}

export interface AgentOptions {
  /** "halt": stop at a failed step and wait for retry or skip. "continue": keep going. */
  onError?: "halt" | "continue";
  /** milliseconds spent in "queued" before the first step starts */
  queuedMs?: number;
}

export interface AgentSnapshot {
  status: RunStatus;
  steps: StepState[];
  log: LogEntry[];
  /** total run time in ms of simulated time */
  elapsed: number;
  activeId: string | null;
  speed: number;
}

const TICK = 50;

const toState = (d: StepDef): StepState => ({ ...d, status: "pending", elapsed: 0, attempts: 0 });

export class MockAgent {
  private snap: AgentSnapshot;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private opts: Required<AgentOptions>;
  private queuedLeft = 0;

  constructor(steps: StepDef[] = [], opts: AgentOptions = {}) {
    this.opts = { onError: opts.onError ?? "halt", queuedMs: opts.queuedMs ?? 500 };
    this.snap = { status: "idle", steps: steps.map(toState), log: [], elapsed: 0, activeId: null, speed: 1 };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  dispose() {
    this.stopTimer();
    this.listeners.clear();
  }

  private emit(patch: Partial<AgentSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }
  private log(text: string, kind: LogEntry["kind"], stepId?: string) {
    const entry: LogEntry = { t: Date.now(), text, kind, stepId };
    return [...this.snap.log, entry];
  }
  private patchStep(id: string, patch: Partial<StepState>, steps = this.snap.steps) {
    return steps.map((s) => (s.id === id ? { ...s, ...patch } : s));
  }
  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK);
  }
  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ── lifecycle ────────────────────────────────────────────────────────────
  load(defs: StepDef[], opts?: AgentOptions) {
    this.stopTimer();
    if (opts) this.opts = { ...this.opts, ...opts };
    this.emit({ status: "idle", steps: defs.map(toState), log: [], elapsed: 0, activeId: null });
  }

  reset() {
    this.stopTimer();
    this.emit({
      status: "idle",
      steps: this.snap.steps.map((s) => toState(s)),
      log: [],
      elapsed: 0,
      activeId: null,
    });
  }

  setSpeed(speed: number) {
    this.emit({ speed });
  }

  run() {
    if (this.snap.status === "running" || this.snap.status === "queued") return;
    this.queuedLeft = this.opts.queuedMs;
    this.emit({
      status: "queued",
      steps: this.snap.steps.map((s) => (s.status === "done" || s.status === "skipped" ? s : toState(s))),
      log: this.log("Run queued", "system"),
    });
    this.startTimer();
  }

  pause() {
    if (this.snap.status !== "running") return;
    this.emit({ status: "paused", log: this.log("Run paused", "human") });
  }
  resume() {
    if (this.snap.status !== "paused") return;
    this.emit({ status: "running", log: this.log("Run resumed", "human") });
  }
  cancel() {
    if (["done", "idle", "cancelled"].includes(this.snap.status)) return;
    this.stopTimer();
    const steps = this.snap.steps.map((s) =>
      s.status === "active" || s.status === "waiting" ? { ...s, status: "skipped" as const, note: "Cancelled" } : s
    );
    this.emit({ status: "cancelled", steps, activeId: null, log: this.log("Run cancelled", "human") });
  }

  /** Approve or decline a step that is waiting on a person. */
  decide(id: string, decision: "approve" | "decline", note?: string) {
    const step = this.snap.steps.find((s) => s.id === id);
    if (!step || step.status !== "waiting") return;
    const steps = this.patchStep(
      id,
      decision === "approve"
        ? { status: "done", elapsed: step.duration }
        : { status: "skipped", declined: true, note: note ?? "Declined by you" }
    );
    this.emit({
      steps,
      status: "running",
      activeId: null,
      log: this.log(
        decision === "approve" ? `Approved: ${step.label}` : `Declined: ${step.label}`,
        "human",
        id
      ),
    });
  }

  retry(id: string) {
    const step = this.snap.steps.find((s) => s.id === id);
    if (!step || step.status !== "failed") return;
    this.emit({
      steps: this.patchStep(id, { status: "pending", elapsed: 0, attempts: step.attempts, error: undefined }),
      status: "running",
      log: this.log(`Retrying: ${step.label}`, "human", id),
    });
    this.startTimer();
  }
  skip(id: string) {
    const step = this.snap.steps.find((s) => s.id === id);
    if (!step || step.status !== "failed") return;
    this.emit({
      steps: this.patchStep(id, { status: "skipped", note: "Skipped by you" }),
      status: "running",
      log: this.log(`Skipped: ${step.label}`, "human", id),
    });
    this.startTimer();
  }

  // ── plan editing ────────────────────────────────────────────────────────
  insertAfter(afterId: string | null, def: StepDef) {
    const steps = [...this.snap.steps];
    const idx = afterId ? steps.findIndex((s) => s.id === afterId) : -1;
    steps.splice(idx + 1, 0, { ...toState(def), fresh: true });
    this.emit({ steps, log: this.log(`Added step: ${def.label}`, "human", def.id) });
    // clear the "fresh" flag after the entrance animation
    setTimeout(() => {
      this.emit({ steps: this.snap.steps.map((s) => (s.id === def.id ? { ...s, fresh: false } : s)) });
    }, 700);
  }
  append(def: StepDef) {
    const last = this.snap.steps[this.snap.steps.length - 1];
    this.insertAfter(last ? last.id : null, def);
  }
  remove(id: string) {
    const step = this.snap.steps.find((s) => s.id === id);
    if (!step || step.status === "active") return;
    this.emit({ steps: this.snap.steps.filter((s) => s.id !== id), log: this.log(`Removed step: ${step.label}`, "human", id) });
  }
  move(from: number, to: number) {
    const steps = [...this.snap.steps];
    if (from < 0 || from >= steps.length || to < 0 || to >= steps.length) return;
    const [item] = steps.splice(from, 1);
    steps.splice(to, 0, item);
    this.emit({ steps });
  }

  // ── simulation ──────────────────────────────────────────────────────────
  private tick() {
    const { status, speed } = this.snap;
    if (status === "queued") {
      this.queuedLeft -= TICK * speed;
      if (this.queuedLeft <= 0) this.emit({ status: "running", log: this.log("Run started", "system") });
      else this.emit({ elapsed: this.snap.elapsed + TICK * speed });
      return;
    }
    if (status !== "running" && status !== "waiting") {
      if (status !== "paused") this.stopTimer();
      return;
    }
    if (status === "waiting") {
      this.emit({ elapsed: this.snap.elapsed + TICK * speed });
      return;
    }

    let steps = this.snap.steps;
    let active = steps.find((s) => s.status === "active");

    if (!active) {
      const next = steps.find((s) => s.status === "pending");
      if (!next) {
        const failed = steps.some((s) => s.status === "failed");
        this.stopTimer();
        this.emit({
          status: failed && this.opts.onError === "halt" ? "failed" : "done",
          activeId: null,
          log: this.log(failed ? "Run finished with failures" : "Run complete", failed ? "error" : "system"),
        });
        return;
      }
      steps = this.patchStep(next.id, { status: "active", elapsed: 0, attempts: next.attempts + 1 });
      this.emit({
        steps,
        activeId: next.id,
        elapsed: this.snap.elapsed + TICK * speed,
        log: this.log(next.label, "auto", next.id),
      });
      return;
    }

    if (active.kind === "wait-approval") {
      this.emit({
        steps: this.patchStep(active.id, { status: "waiting" }),
        status: "waiting",
        activeId: active.id,
        log: this.log(`Waiting for you: ${active.label}`, "system", active.id),
      });
      return;
    }

    const elapsed = active.elapsed + TICK * speed;
    if (elapsed < active.duration) {
      this.emit({
        steps: this.patchStep(active.id, { elapsed }),
        elapsed: this.snap.elapsed + TICK * speed,
      });
      return;
    }

    // the step finished: decide how
    const outcome = active.attempts > 1 ? active.retryOutcome ?? "success" : active.outcome ?? "success";
    if (outcome === "error") {
      this.emit({
        steps: this.patchStep(active.id, { status: "failed", elapsed: active.duration, error: active.error ?? "The step failed" }),
        activeId: null,
        elapsed: this.snap.elapsed + TICK * speed,
        status: this.opts.onError === "halt" ? "failed" : "running",
        log: this.log(`Failed: ${active.label}`, "error", active.id),
      });
      if (this.opts.onError === "halt") this.stopTimer();
      return;
    }
    this.emit({
      steps: this.patchStep(active.id, { status: "done", elapsed: active.duration, partial: outcome === "partial" }),
      activeId: null,
      elapsed: this.snap.elapsed + TICK * speed,
      log: this.log(outcome === "partial" ? `Partly done: ${active.label}` : `Done: ${active.label}`, "auto", active.id),
    });
  }
}

/** React binding: one agent per component, re-rendering on every change. */
export function useMockAgent(initial: StepDef[] = [], opts: AgentOptions = {}) {
  const ref = useRef<MockAgent | null>(null);
  if (!ref.current) ref.current = new MockAgent(initial, opts);
  const agent = ref.current;
  const [snap, setSnap] = useState(agent.getSnapshot());
  useEffect(() => {
    const unsub = agent.subscribe(() => setSnap(agent.getSnapshot()));
    return () => {
      unsub();
      agent.dispose();
    };
  }, [agent]);
  return { agent, ...snap };
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const uid = (p = "s") => `${p}-${Math.random().toString(36).slice(2, 8)}`;
