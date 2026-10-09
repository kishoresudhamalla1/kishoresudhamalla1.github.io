import { useEffect, useRef, useState } from "react";
import { Badge, Button, Chip, Icon, Panel, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type Kind = "actionable" | "ambiguous" | "scope";
interface Seed {
  id: Kind;
  label: string;
  prompt: string;
  confidence: number; // internal, shown only as a band
  understood: string;
  options?: string[];
  no?: string;
  adjacent?: { label: string; result: string };
  done: string;
}

const SEEDS: Seed[] = [
  {
    id: "actionable",
    label: "Clear request",
    prompt: "Reschedule my 3pm with Dana to tomorrow morning",
    confidence: 0.93,
    understood: "Move “Sync with Dana” from today 3:00 pm to tomorrow 9:00 am and notify Dana.",
    done: "Moved to tomorrow 9:00 am. Dana has been notified.",
  },
  {
    id: "ambiguous",
    label: "Ambiguous",
    prompt: "Clean up the Q3 report",
    confidence: 0.46,
    understood: "Fix formatting and typos in the Q3 report.",
    options: ["Fix formatting and typos", "Cut it down to one page", "Remove outdated figures"],
    done: "Done. Formatting and typos are fixed, with every change tracked.",
  },
  {
    id: "scope",
    label: "Out of scope",
    prompt: "Book me a flight to Lisbon",
    confidence: 0.9,
    understood: "",
    no: "I can't book flights or take payments.",
    adjacent: { label: "Draft an itinerary and price comparison", result: "Drafted a 3 day itinerary with 4 flight options to compare and book yourself." },
    done: "",
  },
];

type Phase = "idle" | "analysing" | "result" | "working" | "done";

function band(c: number) {
  return c >= 0.8 ? "High" : c >= 0.55 ? "Medium" : "Low";
}

function classify(text: string): Seed {
  const exact = SEEDS.find((s) => s.prompt.toLowerCase() === text.trim().toLowerCase());
  if (exact) return exact;
  const t = text.toLowerCase();
  if (/(flight|book|buy|pay|order)/.test(t)) return { ...SEEDS[2], prompt: text };
  if (text.trim().split(/\s+/).length <= 3)
    return { ...SEEDS[1], prompt: text, understood: `Summarise “${text.trim()}”.`, options: ["Summarise it", "Rewrite it", "Check it for errors"], done: "Done. Here is a short summary with the key points." };
  return { ...SEEDS[0], prompt: text, understood: text.trim().replace(/^./, (c) => c.toUpperCase()) + ".", done: "Done. The change has been made." };
}

export default function IntentUnderstanding() {
  const [text, setText] = useState(SEEDS[1].prompt);
  const [threshold, setThreshold] = useState(0.75);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seed, setSeed] = useState<Seed | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [other, setOther] = useState(false);
  const [otherText, setOtherText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const later = (fn: () => void, ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  const send = (value = text) => {
    if (!value.trim()) return;
    setChoice(null);
    setOther(false);
    setOtherText("");
    setSeed(classify(value));
    setPhase("analysing");
    later(() => setPhase("result"), 1100);
  };

  const pick = (label: string) => {
    setChoice(label);
    setPhase("working");
    later(() => setPhase("done"), 1300);
  };

  const scopeAction = () => {
    setChoice(seed?.adjacent?.label ?? "");
    setPhase("working");
    later(() => setPhase("done"), 1400);
  };

  const decision: "proceed" | "ask" | "scope" | null =
    !seed ? null : seed.id === "scope" ? "scope" : seed.confidence >= threshold ? "proceed" : "ask";
  const autoProceeded = phase === "result" && decision === "proceed";
  const guessed = autoProceeded && seed?.id === "ambiguous";

  // a confident request starts working by itself once the strip has been read
  useEffect(() => {
    if (phase === "result" && decision === "proceed") {
      const t = setTimeout(() => {
        setChoice(seed?.understood ?? "");
        setPhase("working");
        later(() => setPhase("done"), 1300);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [phase, decision, seed]);

  const segs = seed ? (seed.confidence >= 0.8 ? 3 : seed.confidence >= 0.55 ? 2 : 1) : 0;
  const showStrip = seed && (phase === "working" || phase === "done" || autoProceeded) && decision !== "scope";

  return (
    <div className="lab-stack">
      <Panel title="Try a request">
        <div className="iu-examples lab-row">
          {SEEDS.map((s) => (
            <Chip key={s.id} tone="user" onClick={() => { setText(s.prompt); send(s.prompt); }}>
              {s.label}
            </Chip>
          ))}
        </div>

        <form className="iu-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
          <input className="lab-input" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your request" placeholder="Ask for something" />
          <Button variant="agent" type="submit" disabled={phase === "analysing" || phase === "working"}>
            <Icon name="send" size={13} />Send
          </Button>
        </form>

        <label className="iu-threshold lab-small">
          <span>
            Ask-first threshold: <strong>{Math.round(threshold * 100)}%</strong>
            <span className="lab-muted"> The agent asks only when its confidence is below this. This one number is the real design decision.</span>
          </span>
          <input type="range" min={50} max={95} step={5} value={Math.round(threshold * 100)} onChange={(e) => setThreshold(Number(e.target.value) / 100)} aria-label="Ask-first threshold" />
        </label>
      </Panel>

      {phase !== "idle" && seed && (
        <Panel title="What the agent does">
          {phase === "analysing" && (
            <div className="iu-analysing lab-in" role="status">
              <StepStatusIcon status="active" />
              <span>Reading the request and weighing interpretations</span>
            </div>
          )}

          {phase !== "analysing" && decision !== "scope" && (
            <div className="iu-confidence lab-in">
              <span className="iu-meter" aria-label={`Confidence ${band(seed.confidence)}`}>
                {[1, 2, 3].map((n) => (
                  <i key={n} className={cx(n <= segs && "is-on", n <= segs && `tone-${decision === "ask" ? "warn" : "ok"}`)} />
                ))}
              </span>
              <span className="lab-small">
                {band(seed.confidence)} confidence
              </span>
              {decision === "ask" ? <Badge tone="warn">Checking first</Badge> : <Badge tone="ok">Committing</Badge>}
              {guessed && <Badge tone="danger">Guessing: threshold is too low</Badge>}
            </div>
          )}

          {/* ask: one question, answerable in one tap */}
          {phase === "result" && decision === "ask" && seed.options && (
            <div className="iu-ask lab-in">
              <p className="iu-q">Which of these did you mean?</p>
              <div className="lab-row">
                {seed.options.map((o, i) => (
                  <Chip key={o} tone="user" onClick={() => pick(o)}>
                    {o}
                    {i === 0 && <span className="iu-likely">Most likely</span>}
                  </Chip>
                ))}
                <Chip onClick={() => setOther(true)}>Something else</Chip>
              </div>
              {other && (
                <form className="iu-input lab-in" onSubmit={(e) => { e.preventDefault(); if (otherText.trim()) pick(otherText.trim()); }}>
                  <input className="lab-input" autoFocus value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="In a few words" aria-label="What you meant" />
                  <Button type="submit" size="sm">Go</Button>
                </form>
              )}
              <p className="lab-small lab-muted">One question, ranked, one tap. Every extra turn costs the person flow, so it only fires when the answer changes the work.</p>
            </div>
          )}

          {/* proceed: the skip is visible, so it reads as deliberate */}
          {showStrip && (
            <div className={cx("iu-strip lab-in", guessed && "is-guess")}>
              <span className="lab-badge lab-badge--agent">Here is what I understood</span>
              <span>{choice && decision === "ask" ? choice : seed.understood}</span>
              {phase === "working" && <span className="lab-muted lab-small">Working</span>}
            </div>
          )}

          {/* out of scope: a limit plus the nearest yes */}
          {decision === "scope" && phase !== "analysing" && (
            <div className="iu-scope lab-in">
              <p className="iu-q">{seed.no}</p>
              {phase === "result" && seed.adjacent && (
                <>
                  <p className="lab-small">Here is the nearest thing I can do instead:</p>
                  <Button variant="agent" onClick={scopeAction}>{seed.adjacent.label}</Button>
                </>
              )}
              {phase === "working" && <div className="iu-analysing"><StepStatusIcon status="active" /><span>{choice}</span></div>}
              {phase === "done" && seed.adjacent && <div className="iu-done lab-in"><StepStatusIcon status="done" /><span>{seed.adjacent.result}</span></div>}
            </div>
          )}

          {phase === "working" && decision !== "scope" && (
            <div className="iu-analysing lab-in"><StepStatusIcon status="active" /><span>Carrying it out</span></div>
          )}
          {phase === "done" && decision !== "scope" && (
            <div className="iu-done lab-in"><StepStatusIcon status="done" /><span>{seed.done}</span></div>
          )}

          {phase === "done" && (
            <div className="lab-row iu-after">
              <Button size="sm" variant="ghost" onClick={() => send()}>Run again</Button>
              <span className="lab-small lab-muted">Try the slider: raise the threshold and the clear request starts asking too. Lower it and the ambiguous one guesses.</span>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
