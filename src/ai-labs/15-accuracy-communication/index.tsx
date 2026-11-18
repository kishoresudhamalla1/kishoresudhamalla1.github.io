import { useState } from "react";
import { Badge, Button, Panel, Segmented, cx, useToast } from "../_shared/ui";
import "./styles.css";

type Qid = "balance" | "policy" | "payroll";

interface Q {
  id: Qid;
  question: string;
  confidence: "high" | "medium" | "locked";
  source: string;
  answer: string;
  verify?: { label: string; detail: string };
  requiresHuman?: boolean;
}

const QUESTIONS: Record<Qid, Q> = {
  balance: {
    id: "balance",
    question: "How many leave days do I have left?",
    confidence: "high",
    source: "Your leave ledger, synced from HR as of this morning",
    answer: "You have 12 days of annual leave remaining this year.",
  },
  policy: {
    id: "policy",
    question: "Can unused leave carry into next year?",
    confidence: "medium",
    source: "The leave policy document, last updated 8 months ago",
    answer:
      "The policy allows up to 5 days of carry-over. Some contracts negotiated before 2023 have different terms, which this document doesn't cover.",
    verify: { label: "Check against your contract", detail: "Opens your signed offer letter, which overrides the general policy if it says something different." },
  },
  payroll: {
    id: "payroll",
    question: "If I take 2 unpaid days, how much less is my next paycheck?",
    confidence: "locked",
    source: "An estimate from your salary record and the unpaid-leave formula",
    answer: "Roughly ₹4,200 less, based on a per-day rate calculated from your current salary.",
    requiresHuman: true,
  },
};

function ConfidenceBadge({ c }: { c: Q["confidence"] }) {
  if (c === "high") return <Badge tone="ok">High confidence</Badge>;
  if (c === "medium") return <Badge tone="warn">Medium confidence</Badge>;
  return <Badge tone="danger">Estimate only</Badge>;
}

export default function AccuracyCommunication() {
  const [qid, setQid] = useState<Qid>("balance");
  const [verifying, setVerifying] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { show, node } = useToast();
  const q = QUESTIONS[qid];

  const pick = (id: Qid) => {
    setQid(id);
    setVerifying(false);
    setConfirmed(false);
  };

  return (
    <div className="lab-stack">
      {node}
      <Segmented
        label="Question"
        value={qid}
        onChange={pick}
        options={[
          { id: "balance", label: "A system record" },
          { id: "policy", label: "A policy document" },
          { id: "payroll", label: "A payroll calculation" },
        ]}
      />
      <Panel>
        <div key={qid} className="ac-card lab-in">
          <p className="ac-q lab-small"><strong>You:</strong> {q.question}</p>

          <div className={cx("ac-a", q.requiresHuman && "is-locked")}>
            <div className="lab-row ac-a-top">
              <ConfidenceBadge c={q.confidence} />
              <span className="lab-small lab-muted">Source: {q.source}</span>
            </div>
            <p className="ac-answer">{q.answer}</p>
          </div>

          {q.verify && (
            <div className="ac-verify">
              {!verifying ? (
                <Button size="sm" onClick={() => { setVerifying(true); show("Opening your signed offer letter"); }}>
                  {q.verify.label}
                </Button>
              ) : (
                <p className="lab-small lab-in">{q.verify.detail}</p>
              )}
            </div>
          )}

          {q.requiresHuman && (
            <div className="ac-gate lab-in">
              <p className="ac-gate-t">
                <Badge tone="danger">Needs human confirmation</Badge>
              </p>
              <p className="lab-small">
                This touches payroll, so it can't be the final word on its own, however confident it reads. Payroll
                will confirm the exact figure before your next pay run.
              </p>
              {!confirmed ? (
                <Button size="sm" variant="primary" onClick={() => setConfirmed(true)}>Send to Payroll for confirmation</Button>
              ) : (
                <p className="lab-small lab-in ac-sent">Sent. Payroll will confirm the exact amount, not just agree with this estimate.</p>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
