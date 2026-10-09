import { useEffect, useRef, useState } from "react";
import { Badge, Button, Icon, Panel, Segmented, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type Mode = "full" | "partial" | "mistake";

/* ── 1. Full failure: what broke, is my work safe, one way forward ─────── */
function FullFailure() {
  const [state, setState] = useState<"failed" | "retrying" | "ok">("failed");
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  const retry = () => {
    setState("retrying");
    t.current = setTimeout(() => setState("ok"), 1500);
  };
  return (
    <div className={cx("fr-card", `fr-card--${state}`)}>
      {state !== "ok" ? (
        <>
          <div className="fr-title">
            <span className="fr-badge"><Icon name="x" size={14} /></span>
            <strong>I couldn’t finish the quarterly report</strong>
          </div>
          <p className="fr-cause">The billing data source stopped responding after 3 attempts.</p>
          <p className="fr-safe"><StepStatusIcon status="done" /> Your request and the 14 sections already written are saved. Nothing was lost.</p>
          <div className="lab-row">
            <Button variant="primary" onClick={retry} disabled={state === "retrying"}>
              {state === "retrying" ? "Trying again…" : "Try again"}
            </Button>
            <button type="button" className="fr-link">Copy error details</button>
          </div>
        </>
      ) : (
        <div className="fr-ok lab-in">
          <StepStatusIcon status="done" />
          <span>Reconnected. The report finished, picking up at section 15.</span>
          <Button size="sm" variant="ghost" onClick={() => setState("failed")}>Show the failure again</Button>
        </div>
      )}
    </div>
  );
}

/* ── 2. Partial failure: lead with counts, retry only what failed ──────── */
const FAILS = [
  { name: "Acme Corp", reason: "Record locked by another user", fixable: true },
  { name: "Birch Labs", reason: "Region code “UK-X” is not valid", fixable: false },
  { name: "Cedar & Co", reason: "No contact email on file", fixable: true },
  { name: "Delta Freight", reason: "Request timed out", fixable: true },
  { name: "Ember Studio", reason: "Request timed out", fixable: true },
  { name: "Fjord Group", reason: "Record locked by another user", fixable: true },
];

function PartialFailure() {
  const [phase, setPhase] = useState<"idle" | "running" | "partial" | "retrying" | "final">("idle");
  const [n, setN] = useState(0);
  const [retried, setRetried] = useState(0);
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (iv.current && clearInterval(iv.current)), []);

  const start = () => {
    setPhase("running");
    setN(0);
    setRetried(0);
    let i = 0;
    iv.current = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= 48) {
        if (iv.current) clearInterval(iv.current);
        setPhase("partial");
      }
    }, 70);
  };
  const retry = () => {
    setPhase("retrying");
    let i = 0;
    iv.current = setInterval(() => {
      i += 1;
      setRetried(i);
      if (i >= FAILS.length) {
        if (iv.current) clearInterval(iv.current);
        setPhase("final");
      }
    }, 450);
  };

  const done = phase === "idle" ? 0 : phase === "running" ? Math.min(n, 48) - Math.floor(Math.min(n, 48) / 8) : 42;
  const failedNow = phase === "partial" ? FAILS : phase === "retrying" ? FAILS.filter((f, i) => i >= retried || !f.fixable) : phase === "final" ? FAILS.filter((f) => !f.fixable) : [];
  const total = phase === "final" ? 42 + FAILS.filter((f) => f.fixable).length : phase === "retrying" ? 42 + Math.min(retried, FAILS.filter((f, i) => f.fixable && i < retried).length) : done;
  const pct = (total / 48) * 100;

  return (
    <div className="lab-stack">
      <div className="fr-batch">
        <div className="lab-row fr-batch-h">
          <strong>Updating 48 customer records</strong>
          <span className="lab-mono">
            {phase === "idle" ? "Not started" : `${total} of 48 updated`}
          </span>
        </div>
        <div className="fr-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <i style={{ width: `${pct}%` }} className={cx(phase === "partial" && "is-partial", phase === "final" && failedNow.length === 0 && "is-ok")} />
        </div>
        {phase === "idle" && <Button variant="agent" onClick={start}><Icon name="play" size={12} />Start the update</Button>}
        {phase === "running" && <p className="lab-small">Working through the batch…</p>}
      </div>

      {(phase === "partial" || phase === "retrying" || phase === "final") && (
        <div className="fr-fails lab-in">
          <p className="fr-lead">
            {phase === "final"
              ? `${42 + FAILS.filter((f) => f.fixable).length} of 48 updated. ${failedNow.length} need you.`
              : `42 of 48 updated. ${failedNow.length || 0} failed.`}
          </p>
          {failedNow.length > 0 && (
            <ul>
              {failedNow.map((f) => (
                <li key={f.name} className="lab-in">
                  <StepStatusIcon status="failed" />
                  <span className="lab-grow"><strong>{f.name}</strong> <span className="lab-muted">{phase === "final" ? (f.fixable ? f.reason : f.reason + ". Needs you to correct it.") : f.reason}</span></span>
                </li>
              ))}
            </ul>
          )}
          {phase === "retrying" && <p className="lab-small"><StepStatusIcon status="active" /> Retrying only the failed records</p>}
          <div className="lab-row">
            {phase === "partial" && <Button variant="primary" onClick={retry}>Retry failed only</Button>}
            {phase === "final" && <Button size="sm" variant="ghost" onClick={() => setPhase("idle")}>Reset demo</Button>}
          </div>
          <p className="fr-note lab-small">
            Retry skips the 42 already completed. Re-running a finished step is how a reminder email gets sent twice, so recovery only ever touches what failed.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── 3. The agent made a mistake: checkpoints, rollback, chat survives ── */
interface CP {
  label: string;
  files: Record<string, string[]>;
  flag?: "mistake";
}
const CPS: CP[] = [
  { label: "Before any changes", files: { "routes.ts": ['app.get("/orders", handler)'], "rateLimit.ts": [], "tests.ts": [] } },
  { label: "Added the limiter", files: { "routes.ts": ['app.get("/orders", handler)'], "rateLimit.ts": ["export const limit = createLimiter({", "  perMinute: 120,", "})"], "tests.ts": [] } },
  { label: "Wired it into routes", files: { "routes.ts": ["app.use(limit)", 'app.get("/orders", handler)'], "rateLimit.ts": ["export const limit = createLimiter({", "  perMinute: 120,", "})"], "tests.ts": [] } },
  { label: "Lowered the limit", flag: "mistake", files: { "routes.ts": ["app.use(limit)", 'app.get("/orders", handler)'], "rateLimit.ts": ["export const limit = createLimiter({", "  perMinute: 5,", "})"], "tests.ts": [] } },
  { label: "Updated the tests", flag: "mistake", files: { "routes.ts": ["app.use(limit)", 'app.get("/orders", handler)'], "rateLimit.ts": ["export const limit = createLimiter({", "  perMinute: 5,", "})"], "tests.ts": ["expect(limit.perMinute).toBe(5)"] } },
];

function AgentMistake() {
  const [head, setHead] = useState(CPS.length - 1); // where the files are now
  const [view, setView] = useState(CPS.length - 1); // checkpoint being inspected
  const [chat, setChat] = useState<string[]>([
    "You: Add rate limiting to the API.",
    "Agent: Done. I added a limiter, wired it in, tightened the limit and updated the tests.",
    "You: Checkout is failing for everyone now.",
  ]);
  const [flash, setFlash] = useState(false);

  const files = CPS[view].files;
  const prev = CPS[Math.max(0, view - 1)].files;
  const restore = () => {
    if (view === head) return;
    setHead(view);
    setFlash(true);
    setTimeout(() => setFlash(false), 900);
    const reverted = Object.keys(CPS[head].files).filter((f) => CPS[head].files[f].join() !== CPS[view].files[f].join()).length;
    setChat((c) => [...c, `System: Restored to “${CPS[view].label}”. ${reverted} file${reverted === 1 ? "" : "s"} reverted. Your conversation is kept.`]);
  };

  return (
    <div className="fr-cp">
      <div className="fr-cp-chat">
        <p className="lab-mono lab-muted">Conversation (never rolled back)</p>
        <ul>
          {chat.map((m, i) => (
            <li key={i} className={cx("lab-in", m.startsWith("You") && "is-you", m.startsWith("System") && "is-sys")}>{m}</li>
          ))}
        </ul>
      </div>

      <div className="fr-cp-files">
        <div className="lab-row fr-cp-h">
          <span className="lab-mono lab-muted">Files at checkpoint {view}</span>
          {view !== head && <Badge tone="warn">Previewing, not applied</Badge>}
          {view === head && <Badge tone="agent">Current state</Badge>}
        </div>
        {Object.entries(files).map(([name, lines]) => {
          const before = prev[name];
          const changed = before.join() !== lines.join();
          return (
            <div key={name} className={cx("fr-file", flash && "is-flash")}>
              <div className="fr-file-name">{name}{changed && view > 0 && <span className="lab-badge lab-badge--user">Changed here</span>}</div>
              <pre aria-label={`${name} contents`}>
                {lines.length === 0 ? <span className="lab-muted">(empty)</span> : lines.map((l, i) => (
                  <span key={i} className={cx("fr-line", changed && view > 0 && !before.includes(l) && "is-add")}>{l}{"\n"}</span>
                ))}
              </pre>
            </div>
          );
        })}
      </div>

      <div className="fr-cp-line">
        <ol aria-label="Checkpoints">
          {CPS.map((c, i) => (
            <li key={i} className={cx(i > head && "is-undone")}>
              <button type="button" className={cx("fr-dot", i === view && "is-view", i === head && "is-head", c.flag && "is-bad")} onClick={() => setView(i)} aria-label={`Checkpoint ${i}: ${c.label}`} aria-current={i === view} />
              <span className="fr-dot-l">{c.label}</span>
              {c.flag && <span className="fr-dot-flag">Broke checkout</span>}
            </li>
          ))}
        </ol>
        <div className="lab-row">
          <Button variant="primary" onClick={restore} disabled={view === head}><Icon name="undo" size={13} />Restore to here</Button>
          <span className="lab-small lab-muted">Click a checkpoint to preview it, then restore. Only the files change.</span>
        </div>
      </div>
    </div>
  );
}

export default function FailureRecovery() {
  const [mode, setMode] = useState<Mode>("full");
  return (
    <div className="lab-stack">
      <Segmented
        label="Failure mode"
        value={mode}
        onChange={setMode}
        options={[
          { id: "full", label: "Full failure" },
          { id: "partial", label: "Partial failure" },
          { id: "mistake", label: "The agent made a mistake" },
        ]}
      />
      <Panel>
        <div key={mode} className="lab-in">
          {mode === "full" && <FullFailure />}
          {mode === "partial" && <PartialFailure />}
          {mode === "mistake" && <AgentMistake />}
        </div>
      </Panel>
    </div>
  );
}
