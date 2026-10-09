import { useEffect, useMemo, useRef, useState } from "react";
import { useMockAgent, type StepDef } from "../_shared/useMockAgent";
import {
  Button,
  Icon,
  INDICATOR_COPY,
  Panel,
  Segmented,
  StatusPill,
  StepStatusIcon,
  fmtMs,
  runToIndicator,
  type IndicatorState,
} from "../_shared/ui";
import "./styles.css";

const STATES: { id: IndicatorState; label: string }[] = [
  { id: "queued", label: "Queued" },
  { id: "thinking", label: "Thinking" },
  { id: "streaming", label: "Streaming" },
  { id: "waiting", label: "Waiting" },
  { id: "done", label: "Completed" },
  { id: "paused", label: "Paused" },
  { id: "cancelled", label: "Cancelled" },
];

const ANSWER =
  "The migration touches 14 tables and 3 dependent services. Two of them read the legacy column during deploys, so the safe order is: add the new column, backfill in batches, switch reads behind a flag, then drop the old column after one full release cycle.";

/* Part A: every state side by side, so the difference between "I am thinking"
   and "I need you" can be judged by eye. */
function StateGallery() {
  const [state, setState] = useState<IndicatorState>("thinking");
  const meta = INDICATOR_COPY[state];
  return (
    <Panel title="The seven states" aside={<Segmented options={STATES} value={state} onChange={setState} label="Execution state" />}>
      <div className="es-stage" data-state={state}>
        <div className="es-stage-top">
          <StatusPill state={state} />
          <span className="lab-small">{meta.hint}</span>
        </div>

        <div className="es-body" key={state}>
          {state === "queued" && <p className="lab-small">You are second in line. Estimated start in 8 seconds.</p>}
          {state === "thinking" && (
            <ul className="es-steps">
              <li><StepStatusIcon status="done" /> Read the migration plan</li>
              <li><StepStatusIcon status="active" /> Checking dependent services <span className="lab-mono lab-muted">0:04</span></li>
              <li className="lab-muted"><StepStatusIcon status="pending" /> Draft the summary</li>
            </ul>
          )}
          {state === "streaming" && (
            <p className="es-stream">
              {ANSWER.slice(0, 118)}
              <span className="es-caret" aria-hidden="true" />
            </p>
          )}
          {state === "waiting" && (
            <div className="es-ask">
              <strong>Needs your decision</strong>
              <p className="lab-small">Touching production config is outside what you pre-approved. Nothing will run until you choose.</p>
            </div>
          )}
          {state === "done" && <p className="es-stream">{ANSWER}</p>}
          {state === "paused" && <p className="lab-small">Held after step 2 of 3. Everything done so far is saved.</p>}
          {state === "cancelled" && <p className="es-stream">{ANSWER.slice(0, 118)}</p>}
        </div>

        <div className="lab-row es-actions">
          {state === "queued" && <Button size="sm">Cancel</Button>}
          {state === "thinking" && <><Button size="sm"><Icon name="pause" size={12} />Pause</Button><Button size="sm" variant="ghost">Cancel</Button></>}
          {state === "streaming" && <Button size="sm" variant="danger"><Icon name="stop" size={12} />Stop</Button>}
          {state === "waiting" && <><Button size="sm" variant="primary">Approve</Button><Button size="sm">Decline</Button></>}
          {state === "done" && <><Button size="sm">Copy</Button><Button size="sm" variant="ghost">Run again</Button></>}
          {state === "paused" && <Button size="sm" variant="agent"><Icon name="play" size={12} />Resume</Button>}
          {state === "cancelled" && <><Button size="sm">Continue from here</Button><Button size="sm" variant="ghost">Start over</Button></>}
        </div>
      </div>
      <p className="lab-small es-caption">
        Waiting uses an outlined, pulsing amber ring and a tinted card. Thinking uses a filled indigo dot. They differ in shape, motion and colour, so a
        stalled approval cannot be mistaken for work in progress.
      </p>
    </Panel>
  );
}

/* Part B: a real run. Queued, thinking, a human gate, streaming, done. */
type Phase = "idle" | "agent" | "streaming" | "done" | "stopped";

const SCRIPT: StepDef[] = [
  { id: "a", label: "Reading the migration plan", kind: "read", duration: 1500 },
  { id: "b", label: "Checking dependent services", kind: "search", duration: 2000 },
  { id: "c", label: "Approve touching production config", kind: "wait-approval", duration: 0 },
  { id: "d", label: "Drafting the summary", kind: "write", duration: 1300 },
];
const SLOW: StepDef[] = [
  { id: "a", label: "Reading the migration plan", kind: "read", duration: 3000 },
  { id: "b", label: "Checking dependent services", kind: "search", duration: 5500 },
  { id: "d", label: "Drafting the summary", kind: "write", duration: 3500 },
];

function LiveRun() {
  const { agent, status, steps, elapsed, activeId } = useMockAgent(SCRIPT, { queuedMs: 700 });
  const [phase, setPhase] = useState<Phase>("idle");
  const [slow, setSlow] = useState(false);
  const [text, setText] = useState("");
  const words = useMemo(() => ANSWER.split(" "), []);
  const streamRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "agent" && status === "done") setPhase("streaming");
  }, [phase, status]);

  useEffect(() => {
    if (phase !== "streaming") return;
    let i = text ? text.split(" ").length : 0;
    streamRef.current = setInterval(() => {
      i += 1;
      setText(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (streamRef.current) clearInterval(streamRef.current);
        setPhase("done");
      }
    }, 55);
    return () => {
      if (streamRef.current) clearInterval(streamRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = (p95: boolean) => {
    setSlow(p95);
    setText("");
    agent.load(p95 ? SLOW : SCRIPT, { queuedMs: p95 ? 500 : 700 });
    setPhase("agent");
    agent.run();
  };
  const stop = () => {
    if (streamRef.current) clearInterval(streamRef.current);
    setPhase("stopped");
  };
  const reset = () => {
    agent.reset();
    setText("");
    setPhase("idle");
  };

  const indicator: IndicatorState =
    phase === "streaming" ? "streaming" : phase === "done" ? "done" : phase === "stopped" ? "cancelled" : phase === "idle" ? "queued" : runToIndicator(status);
  const active = steps.find((s) => s.id === activeId);
  const running = phase === "agent" && (status === "running" || status === "queued" || status === "waiting" || status === "paused");
  const longWait = slow && phase === "agent" && elapsed > 4000;
  const waiting = steps.find((s) => s.status === "waiting");

  return (
    <Panel
      title="Run it"
      aside={
        <div className="lab-row">
          <Button size="sm" onClick={() => start(true)} disabled={running || phase === "streaming"}>
            Replay at p95 latency (12s)
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={phase === "idle"}>Reset</Button>
        </div>
      }
    >
      <div className="es-composer">
        <div className="es-composer-field lab-small">Summarise the safest order for the database migration.</div>
        {phase === "streaming" ? (
          <Button variant="danger" onClick={stop} aria-label="Stop writing">
            <Icon name="stop" size={12} />Stop
          </Button>
        ) : (
          <Button variant="agent" onClick={() => start(false)} disabled={running} aria-label="Send">
            <Icon name="send" size={13} />Send
          </Button>
        )}
      </div>

      {phase !== "idle" && (
        <div className="es-run lab-in">
          <div className="lab-row es-run-top">
            <StatusPill state={indicator} />
            {phase === "agent" && (status === "running" || status === "waiting") && (
              <span className="lab-mono lab-muted">
                {fmtMs(elapsed)}
                {active ? ` · step ${steps.findIndex((s) => s.id === active.id) + 1} of ${steps.length}: ${active.label}` : ""}
              </span>
            )}
          </div>

          {longWait && (
            <p className="es-longwait">
              This is taking longer than usual, about 12 seconds in total. Current step: {active?.label ?? "working"}. You can stop at any time.
            </p>
          )}

          {phase === "agent" && (
            <ul className="es-steps">
              {steps.map((s) => (
                <li key={s.id} className={s.status === "pending" ? "lab-muted" : undefined}>
                  <StepStatusIcon status={s.status} /> {s.label}
                  {s.status === "active" && <span className="lab-mono lab-muted"> {fmtMs(s.elapsed)}</span>}
                </li>
              ))}
            </ul>
          )}

          {waiting && (
            <div className="es-ask lab-in">
              <strong>Needs your decision</strong>
              <p className="lab-small">This step changes production config. The run is stopped here and keeps waiting for you.</p>
              <div className="lab-row">
                <Button size="sm" variant="primary" onClick={() => agent.decide(waiting.id, "approve")}>Approve</Button>
                <Button size="sm" onClick={() => agent.decide(waiting.id, "decline")}>Decline and continue</Button>
              </div>
            </div>
          )}

          {(phase === "streaming" || phase === "done" || phase === "stopped") && (
            <p className="es-stream">
              {text}
              {phase === "streaming" && <span className="es-caret" aria-hidden="true" />}
            </p>
          )}

          {phase === "stopped" && (
            <p className="lab-small">Stopped. The {text.split(" ").length} words already written are kept, not discarded.</p>
          )}
          {phase === "done" && <p className="lab-small">Finished with a result. Run again or edit the request.</p>}
          {status === "cancelled" && phase === "agent" && (
            <p className="lab-small">Stopped before any text was written. Nothing was changed.</p>
          )}

          {phase === "agent" && (
            <div className="lab-row">
              {status === "running" && <Button size="sm" onClick={() => agent.pause()}><Icon name="pause" size={12} />Pause</Button>}
              {status === "paused" && <Button size="sm" variant="agent" onClick={() => agent.resume()}><Icon name="play" size={12} />Resume</Button>}
              {(status === "running" || status === "queued" || status === "paused" || status === "waiting") && (
                <Button size="sm" variant="ghost" onClick={() => agent.cancel()}>Cancel</Button>
              )}
              {status === "cancelled" && <Button size="sm" onClick={() => start(slow)}>Start over</Button>}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default function ExecutionStates() {
  return (
    <div className="lab-stack">
      <StateGallery />
      <LiveRun />
    </div>
  );
}
