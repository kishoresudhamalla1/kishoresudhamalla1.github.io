import { useMemo, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Badge, Button, Icon, Panel, StatusPill, StepStatusIcon, cx, runToIndicator } from "../_shared/ui";
import "./styles.css";

/** Each batch resolves this many backlog tickets, shown against the budget. */
const BATCH = 14;
const ACTION_CAP = 50;
const MINUTE_CAP = 15;

const SCRIPT: StepDef[] = [
  { id: "b1", label: "Re-tag tickets 1 to 14", kind: "write", duration: 1300 },
  { id: "b2", label: "Re-tag tickets 15 to 28", kind: "write", duration: 1300 },
  { id: "b3", label: "Re-tag tickets 29 to 42", kind: "write", duration: 1300 },
  { id: "checkpoint", label: "Continue past the 50-action budget?", kind: "wait-approval", duration: 0 },
  { id: "b4", label: "Re-tag tickets 43 to 56", kind: "write", duration: 1300 },
  { id: "b5", label: "Summarise what changed", kind: "write", duration: 900 },
];

const TOTAL_DURATION = SCRIPT.reduce((sum, s) => sum + s.duration, 0);

export default function AutonomyBudgets() {
  const { agent, status, steps, elapsed, log } = useMockAgent(SCRIPT, { onError: "halt", queuedMs: 300 });
  const [grants, setGrants] = useState(0);

  const done = steps.filter((s) => s.status === "done").length;
  const writeSteps = steps.filter((s) => s.kind === "write");
  const doneWrites = writeSteps.filter((s) => s.status === "done").length;
  const actionsUsed = Math.min(ACTION_CAP + grants * 20, doneWrites * BATCH);
  const cap = ACTION_CAP + grants * 20;
  const atCap = actionsUsed >= cap;

  const minutesLeft = Math.max(0, Math.round((MINUTE_CAP - (elapsed / TOTAL_DURATION) * MINUTE_CAP) * 10) / 10);
  const running = status === "running" || status === "queued" || status === "waiting" || status === "paused";
  const waiting = steps.find((s) => s.status === "waiting" && s.id === "checkpoint");

  const pct = Math.min(100, Math.round((actionsUsed / cap) * 100));

  const start = () => {
    setGrants(0);
    agent.load(SCRIPT, { onError: "halt" });
    agent.run();
  };

  const extend = () => {
    setGrants((g) => g + 1);
    agent.decide("checkpoint", "approve");
  };
  const stopHere = () => agent.cancel();

  const indicator = runToIndicator(status);
  const audit = useMemo(() => log.filter((l) => l.kind !== "system"), [log]);

  return (
    <div className="lab-stack">
      <Panel
        title="Clean up and re-tag the stale backlog"
        aside={status !== "idle" && <StatusPill state={indicator} />}
      >
        <p className="lab-small ab-goal">
          <strong>Goal:</strong> Work through the stale-ticket backlog unattended, re-tagging each one against current policy.
        </p>

        <div className="ab-budget" role="group" aria-label="Autonomy budget">
          <div className="ab-budget-row">
            <span className="ab-budget-k">Actions</span>
            <span className="lab-mono">{actionsUsed} of {cap}</span>
          </div>
          <div className="ab-bar" aria-hidden="true">
            <div className={cx("ab-bar-fill", atCap && "is-full")} style={{ width: `${pct}%` }} />
          </div>
          <div className="ab-budget-row">
            <span className="ab-budget-k">Time left</span>
            <span className="lab-mono">{running ? `${minutesLeft} min` : "—"}</span>
          </div>
        </div>

        <ul className="ab-steps">
          {steps.map((s) => (
            <li key={s.id} className={cx("ab-step", `ab-step--${s.status}`)}>
              <StepStatusIcon status={s.status} />
              <span className="lab-grow">{s.label}</span>
              {s.kind === "write" && s.status === "done" && <span className="lab-small lab-muted">{BATCH} tickets</span>}
            </li>
          ))}
        </ul>

        {waiting && (
          <div className="ab-card lab-in" role="alertdialog" aria-label="Budget reached">
            <div className="ab-card-h">
              <Icon name="lock" size={14} />
              <strong>Budget reached: {cap} actions used.</strong>
            </div>
            <p className="lab-small">
              The run stopped itself here instead of continuing past what it was given. Grant another block to keep going, or stop and review what's done so far.
            </p>
            <div className="lab-row">
              <Button size="sm" variant="ghost" onClick={stopHere}>Stop here, review now</Button>
              <Button size="sm" variant="agent" onClick={extend}>Grant 20 more actions</Button>
            </div>
          </div>
        )}

        <div className="lab-row ab-controls">
          {(status === "idle" || status === "done" || status === "failed" || status === "cancelled") && (
            <Button variant="agent" onClick={start}>
              <Icon name="send" size={12} />
              Start the cleanup
            </Button>
          )}
          {status === "running" && <Button size="sm" onClick={() => agent.pause()}><Icon name="pause" size={12} />Pause</Button>}
          {status === "paused" && <Button size="sm" variant="agent" onClick={() => agent.resume()}><Icon name="play" size={12} />Resume</Button>}
        </div>

        {status === "done" && (
          <p className="ab-result lab-in">
            {done} of {SCRIPT.length} steps finished. {doneWrites * BATCH} tickets re-tagged
            {grants > 0 ? `, across ${grants + 1} budget grants.` : "."}
          </p>
        )}
        {status === "cancelled" && (
          <p className="ab-result lab-in">
            Stopped at the budget edge, by choice. {doneWrites * BATCH} tickets re-tagged before the run stopped itself; nothing kept going past that without being asked.
          </p>
        )}
      </Panel>

      <Panel title="Budget log" className="ab-log-panel" aside={<span className="lab-small lab-muted">What ran, and where it checked back in</span>}>
        {audit.length === 0 ? (
          <p className="lab-small lab-muted">Nothing yet. Start the cleanup.</p>
        ) : (
          <ul className="ab-log">
            {audit.map((e, i) => (
              <li key={i} className="lab-in">
                <span className="lab-mono lab-muted">{new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <Badge tone={e.kind === "human" ? "user" : "agent"}>{e.kind === "human" ? "You" : "Agent"}</Badge>
                <span>{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
