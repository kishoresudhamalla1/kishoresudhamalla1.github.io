import { useState } from "react";
import { uid, useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Badge, Button, Icon, KindGlyph, Panel, StatusPill, StepStatusIcon, cx, runToIndicator } from "../_shared/ui";
import "./styles.css";

const PLAN: StepDef[] = [
  { id: "p1", label: "Understand the renewal request", kind: "read", duration: 1200 },
  { id: "p2", label: "Find the customer records", kind: "search", duration: 1500 },
  { id: "p3", label: "Draft the renewal email", kind: "write", duration: 1700 },
  {
    id: "p4",
    label: "Check pricing with the finance tool",
    kind: "call-tool",
    duration: 1900,
    outcome: "error",
    retryOutcome: "success",
    error: "The pricing service timed out",
  },
  { id: "p5", label: "Schedule the follow-up call", kind: "call-tool", duration: 1300 },
  { id: "p6", label: "Summarise everything for your review", kind: "write", duration: 1100 },
];

export default function PlanDecomposition() {
  const { agent, status, steps, activeId } = useMockAgent(PLAN, { onError: "halt", queuedMs: 400 });
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [live, setLive] = useState("");

  const started = status !== "idle";
  const firstPending = steps.findIndex((s) => s.status === "pending");
  const done = steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  const failed = steps.find((s) => s.status === "failed");
  const running = status === "running" || status === "queued" || status === "waiting";
  const editable = (i: number) => steps[i].status === "pending";

  const drop = (to: number) => {
    if (drag === null || drag === to) return;
    if (!editable(drag) || to < firstPending) return;
    agent.move(drag, to);
    setDrag(null);
    setOver(null);
  };

  const addCustom = () => {
    const label = custom.trim();
    if (!label) return;
    agent.append({ id: uid(), label, kind: "write", duration: 1200 });
    setCustom("");
  };

  /** The most senior-feeling interaction: a new instruction while it runs. */
  const addLive = () => {
    const label = live.trim();
    if (!label) return;
    const text = label.replace(/^(actually,?\s*)?(also\s*)?/i, "");
    const step: StepDef = { id: uid(), label: text.charAt(0).toUpperCase() + text.slice(1), kind: "call-tool", duration: 1400 };
    // insert straight after whatever is happening now, ahead of the remaining plan
    const anchor = activeId ?? [...steps].reverse().find((s) => s.status === "done" || s.status === "skipped" || s.status === "failed")?.id ?? null;
    agent.insertAfter(anchor, step);
    setLive("");
  };

  const insertFix = () => {
    if (!failed) return;
    agent.insertAfter(failed.id, {
      id: uid(),
      label: "Fall back to cached pricing (updated 2 days ago)",
      kind: "read",
      duration: 1100,
    });
    agent.skip(failed.id);
  };

  const indicator = runToIndicator(status);

  return (
    <div className="lab-stack">
      <Panel
        title="Plan"
        aside={
          <div className="lab-row">
            {started && <StatusPill state={indicator} />}
            <span className="lab-mono lab-muted">{done} of {steps.length} done</span>
          </div>
        }
      >
        <p className="lab-small pd-goal">
          <strong>Goal:</strong> Renew Northwind’s contract for another year and send them the new pricing.
        </p>

        <ol className="pd-list" aria-label="Agent plan">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={cx("pd-item", `pd-item--${s.status}`, s.fresh && "is-fresh", over === i && "is-over", drag === i && "is-drag")}
              draggable={editable(i)}
              onDragStart={() => setDrag(i)}
              onDragOver={(e) => { e.preventDefault(); if (drag !== null) setOver(i); }}
              onDragEnd={() => { setDrag(null); setOver(null); }}
              onDrop={() => drop(i)}
            >
              <div className="pd-row">
                <span className={cx("pd-handle", !editable(i) && "is-off")} aria-hidden="true"><Icon name="drag" size={14} /></span>
                <StepStatusIcon status={s.status} />
                <span className="pd-kind"><KindGlyph kind={s.kind} size={14} /></span>
                <span className="lab-grow pd-label">
                  {s.label}
                  {s.status === "skipped" && <span className="lab-muted"> (skipped)</span>}
                  {s.fresh && <Badge tone="agent">New</Badge>}
                </span>
                {editable(i) && (
                  <span className="pd-tools">
                    <button type="button" aria-label="Move up" disabled={i <= firstPending} onClick={() => agent.move(i, i - 1)}>↑</button>
                    <button type="button" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => agent.move(i, i + 1)}>↓</button>
                    <button type="button" aria-label={`Remove ${s.label}`} onClick={() => agent.remove(s.id)}><Icon name="trash" size={13} /></button>
                  </span>
                )}
              </div>

              {s.status === "failed" && (
                <div className="pd-branch lab-in" role="alert">
                  <p><strong>{s.error}.</strong> The rest of the plan is paused, not lost. Choose how to continue:</p>
                  <div className="lab-row">
                    <Button size="sm" variant="primary" onClick={() => agent.retry(s.id)}>Retry</Button>
                    <Button size="sm" onClick={() => agent.skip(s.id)}>Skip this step</Button>
                    <Button size="sm" variant="agent" onClick={insertFix}>Insert a fix step</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>

        {!running && status !== "done" && (
          <div className="pd-add lab-row">
            <input className="lab-input" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCustom()} placeholder="Add your own step" aria-label="Add your own step" />
            <Button size="sm" onClick={addCustom}><Icon name="plus" size={12} />Add step</Button>
          </div>
        )}

        <div className="lab-row pd-controls">
          {(status === "idle" || status === "cancelled") && <Button variant="agent" onClick={() => agent.run()}><Icon name="play" size={12} />Run plan</Button>}
          {status === "running" && <Button onClick={() => agent.pause()}><Icon name="pause" size={12} />Pause</Button>}
          {status === "paused" && <Button variant="agent" onClick={() => agent.resume()}><Icon name="play" size={12} />Resume</Button>}
          {started && <Button variant="ghost" onClick={() => agent.load(PLAN)}>Reset plan</Button>}
          {status === "idle" && <span className="lab-small lab-muted">Edit first: drag a step, use the arrows, delete one or add your own.</span>}
        </div>
      </Panel>

      {running && (
        <Panel title="Change the plan mid-run">
          <form className="pd-add lab-row" onSubmit={(e) => { e.preventDefault(); addLive(); }}>
            <input className="lab-input" value={live} onChange={(e) => setLive(e.target.value)} placeholder="Actually, also copy legal on the email" aria-label="New instruction" />
            <Button variant="agent" type="submit">Add to the plan</Button>
          </form>
          <p className="lab-small lab-muted">The plan re-arranges in front of you and carries on. It does not restart.</p>
        </Panel>
      )}

      {status === "done" && (
        <div className="pd-finished lab-in">
          <StepStatusIcon status="done" />
          <span>
            Finished. {steps.filter((s) => s.status === "skipped").length > 0 ? "One step was skipped and the summary says so." : "Every step completed."}
          </span>
        </div>
      )}
    </div>
  );
}
