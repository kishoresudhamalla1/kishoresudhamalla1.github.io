import { useEffect, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Badge, Button, Icon, Panel, StepStatusIcon, fmtMs } from "../_shared/ui";
import "./styles.css";

interface SubAgent {
  id: string;
  label: string;
  steps: StepDef[];
  /** folded back into the parent's final answer once this sub-agent is done */
  result: string;
}

const SUBAGENTS: SubAgent[] = [
  {
    id: "policy",
    label: "Check the overtime policy threshold",
    steps: [
      { id: "p1", label: "Reading the overtime policy", kind: "read", duration: 900 },
      { id: "p2", label: "Finding the manager-approval threshold", kind: "search", duration: 1100 },
    ],
    result: "Over 10 hours a week needs manager approval. That's the only threshold the policy sets.",
  },
  {
    id: "records",
    label: "Pull this month's overtime records",
    steps: [
      { id: "r1", label: "Querying the timesheet system", kind: "call-tool", duration: 1200 },
      { id: "r2", label: "Summing hours per employee", kind: "call-tool", duration: 900 },
    ],
    result: "14 employees logged overtime this month. 3 are over 10 hours: Rao, Fenwick and Okoye.",
  },
];

/* One delegated sub-agent: its own mini run with its own steps and status,
   folding to a single result line once done. `onDone` fires exactly once,
   so the parent thread knows when to launch the next one or synthesize. */
function SubAgentCall({ sub, onDone }: { sub: SubAgent; onDone: () => void }) {
  const { agent, status, steps } = useMockAgent(sub.steps, { queuedMs: 0 });
  const [open, setOpen] = useState(true);

  useEffect(() => {
    agent.run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (status !== "done") return;
    setOpen(false);
    onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  return (
    <li className="sd-call lab-in">
      <button type="button" className="sd-call-h" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Badge tone="agent">Sub-agent</Badge>
        <span className="lab-grow sd-call-label">{sub.label}</span>
        {status === "done" ? <StepStatusIcon status="done" /> : <span className="lab-sicon lab-sicon--active" aria-hidden="true" />}
        <span className={`sd-chev ${open ? "is-open" : ""}`}><Icon name="chevron" size={12} /></span>
      </button>

      {open && (
        <ul className="sd-steps lab-in">
          {steps.map((s) => (
            <li key={s.id}>
              <StepStatusIcon status={s.status} /> {s.label}
              {s.status === "active" && <span className="lab-mono lab-muted"> {fmtMs(s.elapsed)}</span>}
            </li>
          ))}
        </ul>
      )}

      {status === "done" && !open && <p className="sd-result lab-small lab-in">{sub.result}</p>}
    </li>
  );
}

export default function SubagentDelegation() {
  const [started, setStarted] = useState(false);
  const [launched, setLaunched] = useState(0); // how many sub-agents have been launched
  const [synthesized, setSynthesized] = useState(false);

  const start = () => {
    setStarted(true);
    setLaunched(1);
    setSynthesized(false);
  };

  const onSubDone = (i: number) => {
    if (i + 1 < SUBAGENTS.length) setLaunched(i + 2);
    else setTimeout(() => setSynthesized(true), 400);
  };

  return (
    <Panel title="Reconcile this month's overtime against policy and flag outliers">
      {!started ? (
        <Button variant="agent" onClick={start}>
          <Icon name="send" size={12} />
          Send
        </Button>
      ) : (
        <div className="lab-stack">
          <ul className="sd-list">
            {SUBAGENTS.slice(0, launched).map((sub, i) => (
              <SubAgentCall key={sub.id} sub={sub} onDone={() => onSubDone(i)} />
            ))}
          </ul>

          {synthesized && (
            <div className="sd-answer lab-in">
              <p>
                3 employees are over the 10-hour threshold this month and need manager approval: <strong>Rao, Fenwick and Okoye</strong>. The other 11 are
                within policy.
              </p>
              <div className="lab-row">
                <Badge tone="agent">2 sub-agents</Badge>
                <Badge tone="neutral">Each traced to its own steps above</Badge>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
