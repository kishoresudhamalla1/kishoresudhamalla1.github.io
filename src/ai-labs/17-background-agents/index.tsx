import { useEffect, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Badge, Button, Icon, Panel, StatusPill, StepStatusIcon, fmtMs, runToIndicator } from "../_shared/ui";
import "./styles.css";

const SCRIPT: StepDef[] = [
  { id: "a", label: "Pulling this month's timesheets", kind: "read", duration: 1400 },
  { id: "b", label: "Checking each entry against policy", kind: "search", duration: 1800 },
  { id: "c", label: "Drafting the audit summary", kind: "write", duration: 1200 },
];

export default function BackgroundAgents() {
  const { agent, status, steps, elapsed, activeId } = useMockAgent(SCRIPT, { queuedMs: 0 });
  const [away, setAway] = useState(false);
  const [seenWhileAway, setSeenWhileAway] = useState(false);

  // The run keeps going whether or not the page is being watched. "Away" only
  // changes what's rendered here, never the agent itself.
  useEffect(() => {
    if (away && status === "done") setSeenWhileAway(true);
  }, [away, status]);

  const start = () => {
    setAway(false);
    setSeenWhileAway(false);
    agent.reset();
    agent.run();
  };
  const active = steps.find((s) => s.id === activeId);
  const pct = Math.min(100, Math.round((elapsed / 4400) * 100));

  if (away) {
    return (
      <Panel title="You navigated away">
        <div className="bg-away">
          <p className="lab-small">
            This is what the rest of the product looks like while the audit keeps running. Nothing here pauses it.
          </p>
          <div className="bg-chip">
            {status === "done" ? (
              <>
                <StepStatusIcon status="done" /> Audit finished
              </>
            ) : (
              <>
                <span className="lab-sicon lab-sicon--active" aria-hidden="true" />
                Audit running · {pct}%
              </>
            )}
          </div>
          <Button size="sm" onClick={() => setAway(false)}>Come back to it</Button>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Audit this month's timesheets against policy">
      {status === "idle" && (
        <Button variant="agent" onClick={start}>
          <Icon name="send" size={12} />
          Start the audit
        </Button>
      )}

      {status !== "idle" && (
        <div className="lab-stack">
          {seenWhileAway && status === "done" && (
            <div className="bg-notice lab-in">
              <Badge tone="agent">Finished while you were away</Badge>
              <p className="lab-small">You left after starting this. It kept running and finished on its own.</p>
            </div>
          )}

          <div className="lab-row">
            <StatusPill state={status === "done" ? "done" : runToIndicator(status)} />
            {status !== "done" && (
              <span className="lab-small">
                {active ? active.label : "Getting started"} <span className="lab-mono lab-muted">{fmtMs(elapsed)}</span>
              </span>
            )}
          </div>

          {status !== "done" && (
            <>
              <ul className="bg-steps">
                {steps.map((s) => (
                  <li key={s.id}><StepStatusIcon status={s.status} /> {s.label}</li>
                ))}
              </ul>
              <Button size="sm" variant="ghost" onClick={() => setAway(true)}>
                <Icon name="chevron" size={12} />
                Leave this page, I'll check back
              </Button>
            </>
          )}

          {status === "done" && (
            <div className="bg-result lab-in">
              <p>38 timesheets checked. 3 entries need manager review before payroll runs.</p>
              <div className="lab-row">
                <Button size="sm" variant="primary">Review the 3 flagged entries</Button>
                <Button size="sm" variant="ghost" onClick={start}>Run again</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
