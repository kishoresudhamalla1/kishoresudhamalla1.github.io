import { useEffect, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Button, Icon, Panel, Segmented, StepStatusIcon, fmtMs } from "../_shared/ui";
import "./styles.css";

/* Genuine steps: each one names a real system call this assistant actually
   makes, in the order it makes it. Total runtime sits in the 8-12s band the
   question asks about, so the steps are what fill that time, not a spinner. */
const GENUINE: StepDef[] = [
  { id: "a", label: "Understanding your request", kind: "read", duration: 1200 },
  { id: "b", label: "Retrieving employee information", kind: "search", duration: 2600 },
  { id: "c", label: "Checking leave policy", kind: "search", duration: 3400 },
  { id: "d", label: "Preparing a response", kind: "write", duration: 2000 },
];

/* Theatrical steps: generic verbs with no referent. They do not correspond to
   any call the system makes, so they would read the same for any question. */
const THEATRE: StepDef[] = [
  { id: "a", label: "Thinking…", kind: "read", duration: 2200 },
  { id: "b", label: "Analyzing deeply", kind: "search", duration: 2600 },
  { id: "c", label: "Processing information", kind: "search", duration: 2600 },
  { id: "d", label: "Finalizing", kind: "write", duration: 1600 },
];

const ANSWER = "You have 12 days of annual leave remaining this year, including the 3 days you used last month.";

export default function MeaningfulThinkingSteps() {
  const [mode, setMode] = useState<"genuine" | "theatre">("genuine");
  const steps = mode === "genuine" ? GENUINE : THEATRE;
  const { agent, status, steps: live, elapsed } = useMockAgent(steps, { queuedMs: 0 });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (status === "done") setDone(true);
  }, [status]);

  const switchMode = (m: "genuine" | "theatre") => {
    setMode(m);
    setDone(false);
    agent.load(m === "genuine" ? GENUINE : THEATRE, { queuedMs: 0 });
  };
  const start = () => {
    setDone(false);
    agent.load(steps, { queuedMs: 0 });
    agent.run();
  };

  return (
    <Panel
      title="How many leave days do I have left?"
      aside={
        <Segmented
          label="Thinking steps"
          value={mode}
          onChange={switchMode}
          options={[
            { id: "genuine", label: "Genuine" },
            { id: "theatre", label: "Theatrical" },
          ]}
        />
      }
    >
      <div key={mode} className="lab-in mt-run">
        {status === "idle" ? (
          <Button variant="agent" onClick={start}>
            <Icon name="play" size={12} />
            Send
          </Button>
        ) : (
          <ul className="mt-steps">
            {live.map((s) => (
              <li key={s.id}>
                <StepStatusIcon status={s.status} /> {s.label}
                {s.status === "active" && <span className="lab-mono lab-muted"> {fmtMs(s.elapsed)}</span>}
              </li>
            ))}
          </ul>
        )}

        {status !== "idle" && !done && <p className="lab-mono lab-muted mt-elapsed">{fmtMs(elapsed)} elapsed</p>}
        {done && <p className="mt-answer lab-in">{ANSWER}</p>}
        {done && <Button size="sm" variant="ghost" onClick={start}><Icon name="play" size={12} />Run again</Button>}
      </div>
    </Panel>
  );
}
