import { useEffect, useRef, useState } from "react";
import { Button, Icon, Panel, StepStatusIcon, fmtMs } from "../_shared/ui";
import "./styles.css";

type Tier = "instant" | "spinner" | "steps" | "slow";

const STEPS = [
  "Understanding your request",
  "Retrieving employee information",
  "Checking leave policy",
  "Preparing a response",
];

const ANSWER = "You have 12 days of annual leave remaining this year.";

// Nielsen Norman Group's three response-time thresholds: under 0.1s reads as
// instant, up to 1s keeps a person's flow uninterrupted, and past 10s their
// attention is gone unless something concrete tells them work is happening.
function tierFor(ms: number): Tier {
  if (ms < 1000) return "instant";
  if (ms < 4000) return "spinner";
  if (ms < 10000) return "steps";
  return "slow";
}
const TIER_LABEL: Record<Tier, string> = {
  instant: "No indicator needed",
  spinner: "A simple spinner",
  steps: "Named steps",
  slow: "Named steps, plus a reassurance",
};

export default function LatencyTrust() {
  const [latency, setLatency] = useState(3000);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (interval.current) clearInterval(interval.current);
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const tier = tierFor(latency);

  const send = () => {
    setStatus("running");
    setElapsed(0);
    setStepIdx(0);
    const start = Date.now();
    const perStep = latency / STEPS.length;
    interval.current = setInterval(() => {
      const e = Date.now() - start;
      setElapsed(Math.min(e, latency));
      setStepIdx(Math.min(STEPS.length - 1, Math.floor(e / perStep)));
    }, 60);
    timer.current = setTimeout(() => {
      if (interval.current) clearInterval(interval.current);
      setElapsed(latency);
      setStatus("done");
    }, latency);
  };

  const reset = () => {
    if (interval.current) clearInterval(interval.current);
    if (timer.current) clearTimeout(timer.current);
    setStatus("idle");
  };

  return (
    <div className="lab-stack">
      <Panel title="Response time" aside={<span className="lab-mono">{fmtMs(latency)}</span>}>
        <input
          type="range"
          min={200}
          max={14000}
          step={100}
          value={latency}
          disabled={status === "running"}
          onChange={(e) => setLatency(Number(e.target.value))}
          className="lt-slider"
          aria-label="Response time"
        />
        <div className="lab-row lt-marks">
          <span>0.2s</span>
          <span>1s</span>
          <span>4s</span>
          <span>10s</span>
          <span>14s</span>
        </div>
        <p className="lab-small lt-tier">At {fmtMs(latency)}: {TIER_LABEL[tier]}.</p>
      </Panel>

      <Panel title="How many leave days do I have left?">
        {status === "idle" && (
          <Button variant="agent" onClick={send}>
            <Icon name="send" size={12} />
            Send
          </Button>
        )}

        {status === "running" && tier === "spinner" && (
          <p className="lab-small lt-wait">
            <span className="lab-sicon lab-sicon--active" aria-hidden="true" /> Thinking
          </p>
        )}

        {status === "running" && (tier === "steps" || tier === "slow") && (
          <ul className="lt-steps">
            {STEPS.map((label, i) => (
              <li key={label}>
                <StepStatusIcon status={i < stepIdx ? "done" : i === stepIdx ? "active" : "pending"} /> {label}
              </li>
            ))}
          </ul>
        )}

        {status === "running" && tier === "slow" && elapsed > 8000 && (
          <p className="lab-small lt-reassure lab-in">Still working. This is taking longer than usual.</p>
        )}

        {status === "done" && <p className="lt-answer lab-in">{ANSWER}</p>}

        {status !== "idle" && (
          <div className="lab-row lt-foot">
            <span className="lab-mono lab-muted">{fmtMs(elapsed)} elapsed</span>
            <Button size="sm" variant="ghost" onClick={reset}>
              Reset
            </Button>
          </div>
        )}
      </Panel>
    </div>
  );
}
