import { useEffect, useState } from "react";
import { useMockAgent, type StepDef, type StepState } from "../_shared/useMockAgent";
import { Badge, Button, Icon, KindGlyph, Kv, Panel, StatusPill, StepStatusIcon, fmtMs, runToIndicator } from "../_shared/ui";
import "./styles.css";

const SCRIPT: StepDef[] = [
  {
    id: "search",
    label: "Searching the web for Q3 revenue guidance",
    kind: "search",
    duration: 1500,
    input: { tool: "web_search", query: "Acme Q3 revenue guidance 2025" },
    output: { results: "6 pages", top: "Investor relations release, Oct 2" },
  },
  {
    id: "read",
    label: "Reading the earnings call transcript",
    kind: "read",
    duration: 1800,
    input: { tool: "file_read", file: "q3-earnings-call.pdf" },
    output: { pages: "42", finding: "Management raised guidance on page 11" },
  },
  {
    id: "api",
    label: "Calling the finance service for quarterly figures",
    kind: "call-tool",
    duration: 2800,
    input: { tool: "api_call", endpoint: "/v2/quarterly-revenue", range: "Q2 to Q3" },
    output: { rows: "12", status: "200 OK" },
    children: [
      { label: "Authenticating with the finance service", kind: "call-tool" },
      { label: "Fetching quarterly figures", kind: "search" },
    ],
  },
  {
    id: "code",
    label: "Calculating growth",
    kind: "call-tool",
    duration: 1200,
    input: { tool: "code_execution", expression: "(q3 - q2) / q2" },
    output: { result: "14.2%", note: "Matches the transcript" },
  },
];

function childStatus(parent: StepState, i: number): "pending" | "active" | "done" {
  if (parent.status === "done") return "done";
  if (parent.status !== "active" || !parent.children) return "pending";
  const n = parent.children.length + 1;
  const p = parent.elapsed / parent.duration;
  if (p > (i + 1) / n) return "done";
  if (p >= i / n) return "active";
  return "pending";
}

function Call({ step, detail }: { step: StepState; detail: boolean }) {
  const [open, setOpen] = useState(false);
  const summary = step.output ? Object.values(step.output).slice(0, 2).join(" · ") : "";
  return (
    <li className={`to-call to-call--${step.status} lab-in`}>
      <div className="to-call-row">
        <StepStatusIcon status={step.status} />
        <span className="to-kind"><KindGlyph kind={step.kind} size={15} /></span>
        <span className="lab-grow">
          <span className="to-label">{step.label}</span>
          {step.status === "done" && summary && <span className="to-summary">{summary}</span>}
        </span>
        <span className="lab-mono lab-muted">{step.status === "active" ? fmtMs(step.elapsed) + "." + Math.floor((step.elapsed % 1000) / 100) : step.status === "done" ? (step.duration / 1000).toFixed(1) + "s" : ""}</span>
        {detail && step.status === "done" && (
          <button type="button" className="to-more" aria-expanded={open} onClick={() => setOpen(!open)} aria-label={`Details for ${step.label}`}>
            <Icon name="chevron" size={13} />
          </button>
        )}
      </div>

      {step.children && (step.status === "active" || step.status === "done") && (
        <ul className="to-nested" aria-label="Nested calls">
          {step.children.map((c, i) => (
            <li key={c.label} className="lab-in">
              <StepStatusIcon status={childStatus(step, i)} />
              <KindGlyph kind={c.kind} size={13} />
              <span>{c.label}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="to-payload lab-in">
          <div><span className="lab-badge lab-badge--agent">Input</span><Kv data={step.input ?? {}} /></div>
          <div><span className="lab-badge lab-badge--ok">Output</span><Kv data={step.output ?? {}} /></div>
        </div>
      )}
    </li>
  );
}

export default function ToolOrchestration() {
  const { agent, status, steps, elapsed, activeId } = useMockAgent(SCRIPT, { queuedMs: 500 });
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (status === "done") setExpanded(false);
    if (status === "running" || status === "queued") setExpanded(true);
  }, [status]);

  const doneCount = steps.filter((s) => s.status === "done").length;
  const active = steps.find((s) => s.id === activeId);
  const running = status === "running" || status === "queued";
  const visible = steps.filter((s) => s.status !== "pending" || running);

  return (
    <div className="lab-stack">
      <Panel
        title="Ask"
        aside={
          <Button variant="agent" size="sm" disabled={running} onClick={() => { agent.reset(); agent.run(); }}>
            <Icon name="send" size={12} />{status === "idle" ? "Run" : "Run again"}
          </Button>
        }
      >
        <div className="to-ask lab-small">What did Acme guide for Q3 revenue growth, and does it match the transcript?</div>

        {status !== "idle" && (
          <div className="to-feed lab-in">
            <div className="to-head">
              <StatusPill state={status === "done" ? "done" : runToIndicator(status)} />
              {running ? (
                <span className="lab-small">
                  This may take a minute. Now: <strong>{active ? active.label : "getting started"}</strong>
                </span>
              ) : (
                <span className="lab-small">Finished in {fmtMs(elapsed)}</span>
              )}
              <span className="lab-mono lab-muted to-clock" aria-label="Elapsed time">{fmtMs(elapsed)}</span>
            </div>

            {status === "done" && !expanded ? (
              <button type="button" className="to-collapsed" onClick={() => setExpanded(true)} aria-expanded="false">
                <Icon name="check" size={13} />
                Completed {doneCount} steps
                <span className="lab-muted">· 1 nested call</span>
                <span className="lab-grow" />
                <span className="lab-muted">Show steps</span>
                <Icon name="chevron" size={13} />
              </button>
            ) : (
              <>
                <ul className="to-list">
                  {visible.map((s) => (
                    <Call key={s.id} step={s} detail={status === "done"} />
                  ))}
                </ul>
                {status === "done" && (
                  <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Collapse to a summary</Button>
                )}
              </>
            )}

            {status === "done" && (
              <div className="to-answer lab-in">
                <p>
                  Management guided to <strong>14.2% growth</strong> for Q3, up from 11% in Q2. The finance figures confirm it, so the guidance and the
                  transcript agree.
                </p>
                <div className="lab-row">
                  <Badge tone="agent">4 tool calls</Badge>
                  <Badge tone="neutral">Details one click away</Badge>
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
