import { useRef, useState } from "react";
import { Badge, Button, Chip, Icon, Panel, Segmented, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type Mode = "partial" | "clarify" | "retry" | "escalate";

/* 1. Partial: answer what's known, name what isn't, instead of failing the
   whole request because one part of it came back empty. */
function Partial() {
  return (
    <div className="ir-card">
      <p className="ir-q lab-small"><strong>You:</strong> Has my leave request for next week been approved?</p>
      <div className="ir-a">
        <p>
          Your request for 3 days from the 14th is still <strong>pending</strong> with your manager, submitted 2 days
          ago.
        </p>
        <p className="ir-missing">
          <Badge tone="warn">Missing</Badge> I couldn't reach the approvals system to confirm whether it's been seen
          yet. That part of the answer isn't in here.
        </p>
      </div>
      <div className="lab-row">
        <Button size="sm">Notify me when it's answered</Button>
        <Button size="sm" variant="ghost">Try the approvals check again</Button>
      </div>
    </div>
  );
}

/* 2. Clarification: ask one answerable question instead of guessing. */
function Clarify() {
  const [picked, setPicked] = useState<string | null>(null);
  const TYPES = ["Annual leave", "Sick leave", "Compensatory off"];
  return (
    <div className="ir-card">
      <p className="ir-q lab-small"><strong>You:</strong> How many days do I have left?</p>
      <div className="ir-a">
        <p>You track three kinds of leave. Which one do you mean?</p>
        <div className="lab-row ir-chips">
          {TYPES.map((t) => (
            <Chip key={t} tone="user" active={picked === t} onClick={() => setPicked(t)}>{t}</Chip>
          ))}
        </div>
      </div>
      {picked && (
        <p className="ir-answer lab-in">
          {picked === "Annual leave" && "You have 12 days of annual leave remaining this year."}
          {picked === "Sick leave" && "You have 6 days of sick leave remaining this year."}
          {picked === "Compensatory off" && "You have 1.5 days of compensatory off, expiring in 18 days."}
        </p>
      )}
    </div>
  );
}

/* 3. Retry: a dependency fails, the system retries transparently, and if it
   still fails that's shown rather than silently returning stale data. */
function Retry() {
  const [phase, setPhase] = useState<"idle" | "try1" | "fail1" | "try2" | "ok" | "gaveup">("idle");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setPhase("try1");
    t.current = setTimeout(() => setPhase("fail1"), 1100);
  };
  const retryOnce = () => {
    setPhase("try2");
    t.current = setTimeout(() => setPhase("ok"), 1300);
  };
  const giveUp = () => setPhase("gaveup");
  const reset = () => setPhase("idle");

  return (
    <div className="ir-card">
      <p className="ir-q lab-small"><strong>You:</strong> What does the leave policy say about carry-over?</p>
      {phase === "idle" && <Button size="sm" variant="agent" onClick={start}><Icon name="play" size={12} />Ask the question</Button>}
      {(phase === "try1" || phase === "try2") && (
        <p className="lab-small"><StepStatusIcon status="active" /> Checking the policy service{phase === "try2" ? ", attempt 2 of 2" : ""}…</p>
      )}
      {phase === "fail1" && (
        <div className="ir-fail lab-in">
          <p><StepStatusIcon status="failed" /> The policy service didn't respond. Retrying automatically, once.</p>
          <div className="lab-row">
            <Button size="sm" variant="primary" onClick={retryOnce}><Icon name="undo" size={12} />Retry now</Button>
            <Button size="sm" variant="ghost" onClick={giveUp}>Stop and ask a person instead</Button>
          </div>
        </div>
      )}
      {phase === "ok" && (
        <p className="ir-answer lab-in">
          Unused annual leave carries over up to 5 days into the next cycle. Anything beyond that is paid out in
          December.
        </p>
      )}
      {phase === "gaveup" && (
        <div className="ir-escal lab-in">
          <Badge tone="warn">Escalated</Badge>
          <p>I couldn't reach the policy service after retrying. I've sent this to HR Ops, who'll reply within a day.</p>
        </div>
      )}
      {phase !== "idle" && <Button size="sm" variant="ghost" onClick={reset}>Reset demo</Button>}
    </div>
  );
}

/* 4. Escalation: a consequential decision stops here, by design, every time. */
function Escalate() {
  const [sent, setSent] = useState(false);
  return (
    <div className="ir-card">
      <p className="ir-q lab-small"><strong>You:</strong> Can you back-date my resignation to last Friday?</p>
      <div className="ir-a">
        <p>This changes your employment record and your final pay calculation. I can't make that change myself.</p>
      </div>
      {!sent ? (
        <Button size="sm" variant="primary" onClick={() => setSent(true)}>Send to your HR partner</Button>
      ) : (
        <div className="ir-escal lab-in">
          <Badge tone="agent">Handed off</Badge>
          <p>
            Sent to <strong>Asha Rao, HR Partner</strong>, with your request and the dates involved attached. She'll
            follow up within 1 business day. This isn't a queue position, it's a named person who now has it.
          </p>
        </div>
      )}
    </div>
  );
}

const COPY: Record<Mode, string> = {
  partial: "A useful answer with a named gap, not a refusal because one part is missing.",
  clarify: "One answerable question, asked only when the information genuinely isn't there.",
  retry: "A failed dependency retried once, visibly, before it's treated as a real failure.",
  escalate: "A decision that always goes to a person, independent of the model's confidence.",
};

export default function IncompleteResponses() {
  const [mode, setMode] = useState<Mode>("partial");
  return (
    <div className="lab-stack">
      <Segmented
        label="Incomplete state"
        value={mode}
        onChange={setMode}
        options={[
          { id: "partial", label: "Partial response" },
          { id: "clarify", label: "Needs clarification" },
          { id: "retry", label: "Service failed" },
          { id: "escalate", label: "Needs escalation" },
        ]}
      />
      <Panel>
        <p className={cx("lab-small", "ir-mode-copy")}>{COPY[mode]}</p>
        <div key={mode} className="lab-in">
          {mode === "partial" && <Partial />}
          {mode === "clarify" && <Clarify />}
          {mode === "retry" && <Retry />}
          {mode === "escalate" && <Escalate />}
        </div>
      </Panel>
    </div>
  );
}
