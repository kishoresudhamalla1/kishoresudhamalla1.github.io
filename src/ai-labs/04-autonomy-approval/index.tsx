import { useEffect, useMemo, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import { Badge, Button, Panel, StatusPill, StepStatusIcon, cx, runToIndicator } from "../_shared/ui";
import "./styles.css";

type Tier = "ask" | "low" | "full";
type Risk = "read" | "reversible" | "irreversible";

const TIERS: { id: Tier; label: string; consequence: string }[] = [
  { id: "ask", label: "Ask every time", consequence: "Every action waits for you, even reads. Safest and slowest." },
  { id: "low", label: "Auto-approve low-risk", consequence: "Reads and reversible changes run on their own. Anything irreversible stops for you." },
  { id: "full", label: "Full autonomy", consequence: "Everything runs without asking. You review the audit trail afterwards." },
];

interface Action {
  id: string;
  risk: Risk;
  label: string;
  kind: StepDef["kind"];
  type: string;
  riskLabel: string;
}
const ACTIONS: Action[] = [
  { id: "read", risk: "read", label: "Look up overdue invoices", kind: "read", type: "Read-only lookup", riskLabel: "Read only" },
  { id: "write", risk: "reversible", label: "Mark 12 CRM records as “follow-up sent”", kind: "write", type: "Reversible write", riskLabel: "Reversible" },
  { id: "send", risk: "irreversible", label: "Send the reminder email to 127 recipients", kind: "call-tool", type: "Irreversible send", riskLabel: "Cannot be undone" },
];

const needsApproval = (tier: Tier, risk: Risk, trusted: Set<string>, id: string) => {
  if (trusted.has(id)) return false;
  if (tier === "ask") return true;
  if (tier === "low") return risk === "irreversible";
  return false;
};

const EMAIL_BODY = "Hi, a quick reminder that invoice #INV-2041 is now 14 days overdue. You can pay in one click from the link below. If something is wrong with the invoice just reply and we will fix it.";

export default function AutonomyApproval() {
  const [tier, setTier] = useState<Tier>("low");
  const [trusted, setTrusted] = useState<Set<string>>(new Set());
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(EMAIL_BODY);
  const { agent, status, steps, log } = useMockAgent([], { onError: "halt", queuedMs: 400 });

  const script = useMemo<StepDef[]>(
    () =>
      ACTIONS.map((a) => ({
        id: a.id,
        label: a.label,
        kind: needsApproval(tier, a.risk, trusted, a.id) ? "wait-approval" : a.kind,
        duration: needsApproval(tier, a.risk, trusted, a.id) ? 0 : 1100,
      })),
    [tier, trusted]
  );

  // show the plan for the chosen tier before it runs, without disturbing a live run
  useEffect(() => {
    const st = agent.getSnapshot().status;
    if (st === "idle" || st === "done" || st === "failed" || st === "cancelled") agent.load(script, { onError: "halt" });
  }, [script, agent]);

  const start = () => {
    setEditing(false);
    setBody(EMAIL_BODY);
    setAlwaysAllow(false);
    agent.load(script, { onError: "halt" });
    agent.run();
  };
  const changeTier = (t: Tier) => {
    setTier(t);
    agent.reset();
  };

  const waiting = steps.find((s) => s.status === "waiting");
  const waitingAction = ACTIONS.find((a) => a.id === waiting?.id);
  const running = status === "running" || status === "queued" || status === "waiting";

  const approve = () => {
    if (!waiting || !waitingAction) return;
    if (alwaysAllow && waitingAction.risk !== "irreversible") setTrusted(new Set([...trusted, waitingAction.id]));
    setAlwaysAllow(false);
    setEditing(false);
    agent.decide(waiting.id, "approve");
  };

  const audit = log.filter((l) => l.stepId && (l.text.startsWith("Done:") || l.text.startsWith("Approved:") || l.text.startsWith("Declined:")));
  const sent = steps.find((s) => s.id === "send");
  const sentAuto = sent?.status === "done" && audit.some((a) => a.stepId === "send" && a.text.startsWith("Done:"));

  return (
    <div className="lab-stack">
      <Panel title="How much should it ask?">
        <div className="aa-tiers" role="radiogroup" aria-label="Autonomy tier">
          {TIERS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={tier === t.id} className={cx("aa-tier", tier === t.id && "is-active")} onClick={() => changeTier(t.id)} disabled={running}>
              <span className="aa-tier-name">{t.label}</span>
              <span className="aa-tier-line">{t.consequence}</span>
            </button>
          ))}
        </div>

        <table className="aa-matrix" aria-label="What runs automatically at this tier">
          <thead>
            <tr><th scope="col">Action type</th><th scope="col">Risk</th><th scope="col">At this tier</th></tr>
          </thead>
          <tbody>
            {ACTIONS.map((a) => {
              const ask = needsApproval(tier, a.risk, trusted, a.id);
              return (
                <tr key={a.id}>
                  <td>{a.type}</td>
                  <td><Badge tone={a.risk === "irreversible" ? "danger" : a.risk === "reversible" ? "warn" : "neutral"}>{a.riskLabel}</Badge></td>
                  <td>
                    {trusted.has(a.id) ? <Badge tone="ok">Trusted, runs on its own</Badge> : ask ? <Badge tone="warn">Stops for approval</Badge> : <Badge tone="agent">Runs automatically</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel
        title="Task: follow up on overdue invoices"
        aside={
          <div className="lab-row">
            {status !== "idle" && <StatusPill state={runToIndicator(status)} />}
            <Button variant="agent" size="sm" onClick={start} disabled={running}>{status === "idle" ? "Run task" : "Run again"}</Button>
          </div>
        }
      >
        <ul className="aa-steps">
          {steps.map((s) => {
            const a = ACTIONS.find((x) => x.id === s.id)!;
            return (
              <li key={s.id} className={cx("aa-step", `aa-step--${s.status}`)}>
                <StepStatusIcon status={s.status} />
                <span className="lab-grow">{a.label}</span>
                <Badge tone={a.risk === "irreversible" ? "danger" : a.risk === "reversible" ? "warn" : "neutral"}>{a.riskLabel}</Badge>
              </li>
            );
          })}
        </ul>

        {waiting && waitingAction && (
          <div className="aa-card lab-in" role="alertdialog" aria-label="Approval needed">
            <div className="aa-card-h">
              <strong>{waitingAction.risk === "irreversible" ? `Send this email to 127 recipients?` : waitingAction.risk === "reversible" ? "Update 12 CRM records?" : "Read 127 invoices?"}</strong>
              <Badge tone={waitingAction.risk === "irreversible" ? "danger" : "warn"}>{waitingAction.riskLabel}</Badge>
            </div>

            {waitingAction.id === "send" && (
              <div className="aa-preview">
                <div><span className="lab-mono lab-muted">To</span> 127 customers with overdue invoices</div>
                <div><span className="lab-mono lab-muted">Subject</span> A quick reminder about your invoice</div>
                {editing ? (
                  <textarea className="lab-input" rows={4} value={body} onChange={(e) => setBody(e.target.value)} aria-label="Email body" />
                ) : (
                  <p className="aa-body">{body}</p>
                )}
              </div>
            )}
            {waitingAction.id === "write" && (
              <div className="aa-preview">
                <div><span className="lab-mono lab-muted">Records</span> 12 CRM deals</div>
                <div><span className="lab-mono lab-muted">Change</span> Stage: Invoiced → Follow-up sent</div>
                <div className="lab-small lab-muted">Reversible: the previous stage is stored and can be restored.</div>
              </div>
            )}
            {waitingAction.id === "read" && (
              <div className="aa-preview"><div><span className="lab-mono lab-muted">Source</span> Billing, invoices overdue by 7 days or more</div></div>
            )}

            {waitingAction.risk !== "irreversible" && (
              <label className="aa-trust lab-small">
                <input type="checkbox" checked={alwaysAllow} onChange={(e) => setAlwaysAllow(e.target.checked)} />
                Always allow this kind of action from now on
              </label>
            )}

            <div className="lab-row">
              {waitingAction.id === "send" && !editing && <Button size="sm" onClick={() => setEditing(true)}>Edit</Button>}
              {waitingAction.id === "send" && editing && <Button size="sm" onClick={() => setEditing(false)}>Done editing</Button>}
              <Button size="sm" variant="danger" onClick={() => { setEditing(false); agent.decide(waiting.id, "decline"); }}>Don’t {waitingAction.id === "send" ? "send" : "run"}</Button>
              <Button size="sm" variant="primary" onClick={approve}>{waitingAction.id === "send" ? "Send" : "Approve"}</Button>
            </div>
          </div>
        )}

        {status === "done" && (
          <p className={cx("aa-result lab-in", sentAuto && "is-warn")}>
            {sent?.status === "skipped"
              ? "Email not sent. Nothing irreversible happened."
              : sentAuto
                ? "127 emails went out automatically. That cannot be undone, which is the cost of this tier."
                : "127 emails sent after your approval."}
          </p>
        )}
      </Panel>

      <Panel title="Audit trail" aside={<span className="lab-small lab-muted">What ran on its own and what needed a person</span>}>
        {audit.length === 0 ? (
          <p className="lab-small lab-muted">Nothing yet. Run the task.</p>
        ) : (
          <ul className="aa-audit">
            {audit.map((e, i) => {
              const human = e.kind === "human";
              const irreversibleAuto = !human && e.stepId === "send";
              return (
                <li key={i} className={cx("lab-in", irreversibleAuto && "is-danger")}>
                  <span className="lab-mono lab-muted">{new Date(e.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                  <Badge tone={human ? "user" : "agent"}>{human ? "You" : "Automatic"}</Badge>
                  <span>{e.text.replace(/^Done: /, "Ran: ")}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
