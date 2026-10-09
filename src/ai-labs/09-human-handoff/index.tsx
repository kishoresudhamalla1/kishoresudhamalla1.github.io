import { useEffect, useRef, useState } from "react";
import { Badge, Button, Icon, Panel, Segmented, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type Who = "you" | "agent" | "human" | "system";
interface Msg { who: Who; text: string; }

const SCRIPT: Msg[] = [
  { who: "you", text: "My refund for order #4821 hasn’t arrived. It’s been 12 days." },
  { who: "agent", text: "I can see order #4821. $84.00 was refunded on Oct 2 to your card ending 4417. Banks can take up to 10 business days to show it." },
  { who: "you", text: "That is longer than 10 days. And I was charged twice." },
  { who: "agent", text: "A duplicate charge needs a person to review it. I can hand this over now with everything you have told me." },
];

type Stage = "queued" | "assigned" | "replied";
const STAGES: { id: Stage; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "assigned", label: "Assigned to Priya" },
  { id: "replied", label: "Priya replied" },
];

export default function HumanHandoff() {
  const [msgs, setMsgs] = useState<Msg[]>(SCRIPT.slice(0, 2));
  const [typing, setTyping] = useState(false);
  const [handoff, setHandoff] = useState<Stage | null>(null);
  const [mode, setMode] = useState<"context" | "reset">("context");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing, handoff]);

  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const next = SCRIPT[msgs.filter((m) => m.who === "you" || m.who === "agent").length];

  const advance = () => {
    if (!next || typing || handoff) return;
    setTyping(true);
    later(() => {
      setMsgs((m) => [...m, next]);
      setTyping(false);
    }, 900);
  };

  /** Available at any point, and it carries the conversation with it. */
  const escalate = () => {
    if (handoff) return;
    setMsgs((m) => [...m, { who: "system", text: "Handing you over to Priya (Billing). She typically replies within 5 minutes." }]);
    setHandoff("queued");
    later(() => setHandoff("assigned"), 1800);
    later(() => setHandoff("replied"), 3800);
  };

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMsgs(SCRIPT.slice(0, 2));
    setHandoff(null);
    setTyping(false);
  };

  const said = msgs.map((m) => m.text).join(" ");
  const facts = [
    { k: "Order", v: "#4821", has: /4821/.test(said) },
    { k: "Refund", v: "$84.00 sent Oct 2, card ending 4417", has: /refunded/.test(said) },
    { k: "Waiting", v: "12 days, past the usual 10", has: /12 days/.test(said) },
    { k: "New issue", v: "Charged twice", has: /twice/.test(said) },
  ].filter((f) => f.has);

  const replyContext =
    "Hi, Priya here. I can see the duplicate $84.00 charge on order #4821 and the refund from Oct 2. I’ve started a refund for the second charge. It should show in 3 to 5 days. Is there anything else I can sort out?";
  const replyReset = "Hi, I’m Priya. How can I help you today? Could you give me your order number and tell me what happened?";

  return (
    <div className="hh-grid">
      <Panel
        title="Support chat"
        aside={
          <Button size="sm" variant={handoff ? "ghost" : "default"} onClick={escalate} disabled={!!handoff}>
            <Icon name="user" size={13} />Talk to a person
          </Button>
        }
      >
        <div className="hh-log" ref={log} aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={cx("hh-msg lab-in", `is-${m.who}`)}>
              {m.who === "system" ? (
                <p>{m.text}</p>
              ) : (
                <>
                  <span className="lab-mono lab-muted">{m.who === "you" ? "You" : m.who === "agent" ? "Assistant" : "Priya"}</span>
                  <p>{m.text}</p>
                </>
              )}
            </div>
          ))}
          {typing && <div className="hh-msg is-agent lab-in"><span className="lab-mono lab-muted">Assistant</span><p className="hh-typing"><i /><i /><i /></p></div>}

          {handoff === "replied" && (
            <div className="hh-msg is-human lab-in">
              <span className="lab-mono lab-muted">Priya</span>
              <p>{mode === "context" ? replyContext : replyReset}</p>
            </div>
          )}
        </div>

        {handoff && (
          <ol className="hh-strip lab-in" aria-label="Handoff status">
            {STAGES.map((s, i) => {
              const at = STAGES.findIndex((x) => x.id === handoff);
              return (
                <li key={s.id} className={cx(i < at && "is-done", i === at && "is-now")}>
                  <StepStatusIcon status={i < at ? "done" : i === at ? (handoff === "replied" ? "done" : "active") : "pending"} />
                  {s.label}
                </li>
              );
            })}
          </ol>
        )}

        <div className="lab-row hh-actions">
          {!handoff && next && <Button variant="agent" size="sm" onClick={advance} disabled={typing}>Continue the conversation</Button>}
          {!handoff && !next && <Button variant="primary" size="sm" onClick={escalate}>Yes, hand it over</Button>}
          {handoff && <Button size="sm" variant="ghost" onClick={reset}>Reset demo</Button>}
        </div>
      </Panel>

      <div className="lab-stack">
        <Panel title="What Priya sees" aside={handoff ? <Segmented label="Handoff style" value={mode} onChange={setMode} options={[{ id: "context", label: "A relay" }, { id: "reset", label: "A reset" }]} /> : undefined}>
          {!handoff ? (
            <p className="lab-small lab-muted">Nothing yet. Press “Talk to a person” at any point. It works from the first message onwards.</p>
          ) : mode === "context" ? (
            <div className="lab-in lab-stack">
              <p className="lab-small">The same conversation, in full, plus what the assistant already worked out:</p>
              <ul className="hh-facts">
                {facts.map((f) => (
                  <li key={f.k}><span className="lab-mono lab-muted">{f.k}</span> {f.v}</li>
                ))}
              </ul>
              <div className="hh-test">
                <Badge tone="ok">Passes the handoff test</Badge>
                <span className="lab-small">Priya can resolve this without asking the customer anything they already said.</span>
              </div>
            </div>
          ) : (
            <div className="lab-in lab-stack">
              <p className="lab-small">An empty thread. The customer’s history stayed with the assistant.</p>
              <div className="hh-test is-fail">
                <Badge tone="danger">Fails the handoff test</Badge>
                <span className="lab-small">The customer must repeat the order number, the refund and the double charge. This is a reset wearing a handoff’s clothes.</span>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
