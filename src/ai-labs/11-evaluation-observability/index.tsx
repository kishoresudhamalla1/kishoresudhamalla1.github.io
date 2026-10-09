import { Fragment, useState } from "react";
import { Badge, Button, DiffView, Icon, Kv, Panel, Segmented, cx } from "../_shared/ui";
import "./styles.css";

type Result = "pass" | "fail" | "partial";
type SKind = "agent" | "retrieval" | "tool" | "llm" | "format";

interface Span {
  id: string;
  label: string;
  kind: SKind;
  start: number;
  dur: number;
  depth: number;
  input?: Record<string, string>;
  output?: Record<string, string>;
  error?: string;
  skipped?: boolean;
}
interface Run {
  id: string;
  title: string;
  result: Result;
  latency: number;
  cost: string;
  spans: Span[];
}

const sp = (id: string, label: string, kind: SKind, start: number, dur: number, depth: number, input?: Record<string, string>, output?: Record<string, string>, extra: Partial<Span> = {}): Span => ({ id, label, kind, start, dur, depth, input, output, ...extra });

const RUNS: Run[] = [
  {
    id: "r1", title: "Refund policy question", result: "pass", latency: 2.9, cost: "$0.012",
    spans: [
      sp("a", "Agent run", "agent", 0, 2900, 0),
      sp("b", "Retrieve policy documents", "retrieval", 40, 420, 1, { query: "refund timeline" }, { documents: "5 returned", top: "Refund policy v7" }),
      sp("c", "Look up the customer plan", "tool", 480, 900, 1, { tool: "plan_lookup", customer: "c_2041" }, { plan: "Team", status: "200 OK" }),
      sp("d", "Draft the answer", "llm", 1400, 1440, 1, { model: "assistant-large", tokens_in: "1,812" }, { tokens_out: "96", finish: "stop" }),
      sp("e", "Format the response", "format", 2850, 50, 1, { template: "support_reply" }, { chars: "412" }),
    ],
  },
  {
    id: "r2", title: "Upgrade pricing for the Team plan", result: "pass", latency: 3.4, cost: "$0.015",
    spans: [
      sp("a", "Agent run", "agent", 0, 3400, 0),
      sp("b", "Retrieve pricing page", "retrieval", 40, 380, 1, { query: "team plan price" }, { documents: "3 returned" }),
      sp("d", "Draft the answer", "llm", 450, 2300, 1, { model: "assistant-large", tokens_in: "2,104" }, { tokens_out: "141" }),
      sp("e", "Format the response", "format", 3330, 60, 1, { template: "support_reply" }, { chars: "598" }),
    ],
  },
  {
    id: "r3", title: "Cancel my subscription", result: "fail", latency: 4.1, cost: "$0.009",
    spans: [
      sp("a", "Agent run", "agent", 0, 4100, 0),
      sp("b", "Retrieve cancellation steps", "retrieval", 40, 400, 1, { query: "cancel subscription" }, { documents: "4 returned" }),
      sp("c", "Cancel via the billing API", "tool", 460, 3500, 1, { tool: "billing_api.cancel", customer: "c_8821" }, undefined, { error: "504 Gateway Timeout after 3 retries. This is the step that broke the run." }),
      sp("d", "Draft the answer", "llm", 4000, 100, 1, undefined, undefined, { skipped: true }),
    ],
  },
  {
    id: "r4", title: "Export my account data", result: "partial", latency: 3.1, cost: "$0.011",
    spans: [
      sp("a", "Agent run", "agent", 0, 3100, 0),
      sp("b", "Retrieve export instructions", "retrieval", 40, 360, 1, { query: "export account data" }, { documents: "1 returned", expected: "3 documents", note: "Two relevant pages were filtered out" }),
      sp("d", "Draft the answer", "llm", 420, 2600, 1, { model: "assistant-large", tokens_in: "980" }, { tokens_out: "88", note: "Answered from partial context" }),
    ],
  },
  {
    id: "r5", title: "Reset two-factor authentication", result: "pass", latency: 2.2, cost: "$0.008",
    spans: [
      sp("a", "Agent run", "agent", 0, 2200, 0),
      sp("b", "Retrieve security guide", "retrieval", 40, 300, 1, { query: "reset 2fa" }, { documents: "2 returned" }),
      sp("d", "Draft the answer", "llm", 360, 1750, 1, { model: "assistant-large" }, { tokens_out: "74" }),
    ],
  },
];

interface Row {
  id: string;
  q: string;
  expected: string;
  actual: string;
  prev?: string;
  score: "pass" | "fail";
  wasPass: boolean;
  grader: string;
  cause?: string;
}
const ROWS: Row[] = [
  { id: "e1", q: "How do I reset my password?", expected: "Use “Forgot password” on the sign in page.", actual: "Use “Forgot password” on the sign in page.", score: "pass", wasPass: true, grader: "Exact match" },
  { id: "e2", q: "Can I change my plan mid-month?", expected: "Yes, and the difference is prorated.", actual: "Yes. You are charged only the prorated difference.", score: "pass", wasPass: true, grader: "Judge: same meaning, same facts" },
  { id: "e3", q: "Do you offer student pricing?", expected: "Yes, 40% off with a verified student email.", actual: "Yes, students get 40% off with a verified email.", score: "pass", wasPass: true, grader: "Judge: same meaning, same facts" },
  { id: "e4", q: "How long do refunds take?", expected: "Refunds are processed within 5 business days.", actual: "Refunds usually take about a week.", prev: "Refunds are processed within 5 business days, per policy.", score: "fail", wasPass: true, grader: "Judge: contradicts the policy timeline", cause: "Retrieval returned 0 documents after the prompt change, so the model answered from memory." },
  { id: "e5", q: "Where can I download invoices?", expected: "Billing, then Invoices, then Download.", actual: "Open Billing, then Invoices and choose Download.", score: "pass", wasPass: true, grader: "Judge: same meaning, same facts" },
  { id: "e6", q: "Is my data encrypted?", expected: "Yes, in transit and at rest.", actual: "Your data is encrypted in transit.", score: "fail", wasPass: false, grader: "Judge: omits “at rest”" },
  { id: "e7", q: "Can I invite guests for free?", expected: "Guests are free for up to 5 people.", actual: "Guests are free for up to 5 people.", score: "pass", wasPass: true, grader: "Exact match" },
  { id: "e8", q: "How do I contact support?", expected: "Use in-app chat or email support.", actual: "Use in-app chat or email support.", score: "pass", wasPass: true, grader: "Exact match" },
];

const KIND_TONE: Record<SKind, string> = { agent: "agent", retrieval: "user", tool: "warn", llm: "agent", format: "neutral" };

function Waterfall({ run }: { run: Run }) {
  const total = run.spans[0].dur;
  const [open, setOpen] = useState<string | null>(run.spans.find((s) => s.error)?.id ?? null);
  return (
    <div className="eo-water lab-in" key={run.id}>
      <div className="eo-water-h lab-mono lab-muted"><span>Step</span><span>Timeline ({(total / 1000).toFixed(1)}s)</span></div>
      {run.spans.map((s) => (
        <div key={s.id} className={cx("eo-span", s.error && "is-error", s.skipped && "is-skipped")}>
          <button type="button" className="eo-span-row" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
            <span className="eo-span-name" style={{ paddingLeft: `${s.depth * 1.1}rem` }}>
              <span className={cx("eo-chev", open === s.id && "is-open")}><Icon name="chevron" size={11} /></span>
              <Badge tone={s.error ? "danger" : (KIND_TONE[s.kind] as "agent")}>{s.kind}</Badge>
              {s.label}
            </span>
            <span className="eo-track" aria-hidden="true">
              <i style={{ left: `${(s.start / total) * 100}%`, width: `${Math.max(1.5, (s.dur / total) * 100)}%` }} className={cx(s.error && "is-error", s.skipped && "is-skipped")} />
            </span>
            <span className="lab-mono lab-muted eo-ms">{s.skipped ? "not run" : `${s.dur} ms`}</span>
          </button>
          {open === s.id && (
            <div className="eo-detail lab-in">
              {s.error && <p className="eo-err">{s.error}</p>}
              {s.input && <div><Badge tone="agent">Input</Badge><Kv data={s.input} /></div>}
              {s.output && <div><Badge tone="ok">Output</Badge><Kv data={s.output} /></div>}
              {!s.input && !s.output && !s.error && <p className="lab-small lab-muted">Not executed because an earlier step failed.</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Traces() {
  const [sel, setSel] = useState<string>("r3");
  const run = RUNS.find((r) => r.id === sel)!;
  return (
    <div className="eo-traces">
      <ul className="eo-runs" aria-label="Runs">
        {RUNS.map((r) => (
          <li key={r.id}>
            <button type="button" className={cx("eo-run", sel === r.id && "is-active")} onClick={() => setSel(r.id)} aria-pressed={sel === r.id}>
              <Badge tone={r.result === "pass" ? "ok" : r.result === "fail" ? "danger" : "warn"}>{r.result}</Badge>
              <span className="lab-grow eo-run-t">{r.title}</span>
              <span className="lab-mono lab-muted">{r.latency}s · {r.cost}</span>
            </button>
          </li>
        ))}
      </ul>
      <Waterfall run={run} />
    </div>
  );
}

function Evals() {
  const [only, setOnly] = useState(false);
  const [cmp, setCmp] = useState<string | null>("e4");
  const rows = ROWS.filter((r) => !only || (r.wasPass && r.score === "fail"));
  const pass = ROWS.filter((r) => r.score === "pass").length;
  const reg = ROWS.filter((r) => r.wasPass && r.score === "fail").length;
  return (
    <div className="lab-stack">
      <div className="eo-stats">
        <div><span className="lab-mono lab-muted">Dataset</span><strong>support-faq-v3 · 8 examples</strong></div>
        <div><span className="lab-mono lab-muted">Pass rate</span><strong>{pass} of {ROWS.length}</strong></div>
        <div><span className="lab-mono lab-muted">Regressions</span><strong className="eo-bad">{reg}</strong></div>
        <label className="eo-toggle lab-small"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Show regressions only</label>
      </div>
      <div className="eo-table-wrap">
        <table className="eo-table">
          <thead><tr><th>Example</th><th>Expected</th><th>Actual</th><th>Score</th><th>Grader reasoning</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const regress = r.wasPass && r.score === "fail";
              return (
                <Fragment key={r.id}>
                  <tr className={cx(regress && "is-regress", r.score === "fail" && !regress && "is-fail")}>
                    <td>{r.q}</td>
                    <td>{r.expected}</td>
                    <td>{r.actual}</td>
                    <td><Badge tone={r.score === "pass" ? "ok" : "danger"}>{r.score}</Badge>{regress && <Badge tone="warn">Regression</Badge>}</td>
                    <td className="lab-small">
                      {r.grader}
                      {regress && <> <button type="button" className="eo-link" onClick={() => setCmp(cmp === r.id ? null : r.id)}>{cmp === r.id ? "Hide diff" : "Compare to last good run"}</button></>}
                    </td>
                  </tr>
                  {regress && cmp === r.id && (
                    <tr className="eo-diffrow">
                      <td colSpan={5}>
                        <div className="eo-diff lab-in">
                          <div><span className="lab-mono lab-muted">Last good run → current run</span><DiffView before={r.prev!} after={r.actual} /></div>
                          <div className="eo-cause"><Badge tone="warn">Likely cause</Badge><span className="lab-small">{r.cause}</span></div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function EvaluationObservability() {
  const [tab, setTab] = useState<"traces" | "evals">("traces");
  return (
    <div className="lab-stack">
      <Segmented label="View" value={tab} onChange={setTab} options={[{ id: "traces", label: "Trace viewer" }, { id: "evals", label: "Eval results" }]} />
      <Panel title={tab === "traces" ? "Runs" : "Evaluation"}>
        <div key={tab} className="lab-in">{tab === "traces" ? <Traces /> : <Evals />}</div>
      </Panel>
    </div>
  );
}
