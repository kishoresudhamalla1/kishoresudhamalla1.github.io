import { useEffect, useRef, useState } from "react";
import { Badge, Button, Icon, Panel, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type NodeId = "sup" | "res" | "wri" | "cod";
type NState = "idle" | "working" | "waiting" | "done";

const NODES: Record<NodeId, { name: string; role: string; x: number; y: number }> = {
  sup: { name: "Supervisor", role: "Plans, delegates, reconciles", x: 340, y: 54 },
  res: { name: "Research", role: "Finds reported figures", x: 110, y: 250 },
  wri: { name: "Writing", role: "Drafts the summary", x: 340, y: 250 },
  cod: { name: "Code", role: "Calculates from data", x: 570, y: 250 },
};

interface Ev { at: number; node: NodeId; kind: "asked" | "returned" | "note"; text: string; }
const EVENTS: Ev[] = [
  { at: 0, node: "sup", kind: "note", text: "Goal: summarise Q3 revenue growth for the board." },
  { at: 900, node: "sup", kind: "note", text: "Split into three subgoals: reported figures, a calculation from the finance table, and the write-up." },
  { at: 1400, node: "res", kind: "asked", text: "Supervisor asked: find the reported Q3 revenue growth." },
  { at: 1400, node: "cod", kind: "asked", text: "Supervisor asked: calculate Q3 growth from the finance table." },
  { at: 3200, node: "res", kind: "returned", text: "Returned: 14% year on year, from the October investor release." },
  { at: 3200, node: "cod", kind: "returned", text: "Returned: 11%, against a Q2 base that excludes the one-off licence deal." },
  { at: 3300, node: "sup", kind: "note", text: "Conflict: 14% against 11%. Pausing before anything is written." },
  { at: 4200, node: "res", kind: "asked", text: "Supervisor asked: does your 14% include the one-off licence deal?" },
  { at: 4300, node: "cod", kind: "asked", text: "Supervisor asked: which base period did you use?" },
  { at: 4800, node: "res", kind: "returned", text: "Returned: yes, the release includes the one-off deal." },
  { at: 4900, node: "cod", kind: "returned", text: "Returned: Q2 excluding the one-off deal." },
  { at: 5600, node: "sup", kind: "note", text: "Both are right on different bases. Reporting both, with the reason, instead of picking one." },
  { at: 5800, node: "wri", kind: "asked", text: "Supervisor asked: write a two sentence board summary using both figures, attributed." },
  { at: 7300, node: "wri", kind: "returned", text: "Returned: the final summary, shown below." },
];
const END = 7600;

const between = (t: number, a: number, b: number) => t >= a && t < b;

function stateOf(id: NodeId, t: number): NState {
  if (t < 0) return "idle";
  switch (id) {
    case "sup":
      if (t >= END) return "done";
      if (between(t, 0, 1400)) return "working";
      if (between(t, 1400, 3300)) return "waiting";
      if (between(t, 3300, 5700)) return "working";
      return "waiting";
    case "res":
    case "cod":
      return t < 1400 ? "idle" : t < 3200 ? "working" : "done";
    case "wri":
      return t < 5800 ? "idle" : t < 7300 ? "working" : "done";
  }
}
const conflictOn = (t: number) => between(t, 3300, 5600);
const edgeActive = (to: NodeId, t: number) =>
  to === "wri" ? between(t, 5600, 7300) : between(t, 900, 3300) || (conflictOn(t) && between(t, 4200, 5000));

export default function MultiAgentCoordination() {
  const [t, setT] = useState(-1);
  const [sel, setSel] = useState<NodeId>("sup");
  const iv = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => void (iv.current && clearInterval(iv.current)), []);

  const run = () => {
    if (iv.current) clearInterval(iv.current);
    setT(0);
    setSel("sup");
    let now = 0;
    iv.current = setInterval(() => {
      now += 100;
      setT(now);
      if (now >= END && iv.current) clearInterval(iv.current);
    }, 100);
  };

  const done = t >= END;
  const events = EVENTS.filter((e) => e.node === sel && e.at <= t);
  const sup = stateOf("sup", t);

  return (
    <div className="ma-grid">
      <Panel
        title="Supervisor and specialists"
        aside={
          <Button variant="agent" size="sm" onClick={run} disabled={t >= 0 && !done}>
            <Icon name="play" size={12} />{t < 0 ? "Run" : done ? "Run again" : "Running"}
          </Button>
        }
      >
        <svg className="ma-svg" viewBox="0 0 680 330" role="group" aria-label="Agent graph">
          {(["res", "wri", "cod"] as NodeId[]).map((to) => {
            const a = NODES.sup;
            const b = NODES[to];
            const on = edgeActive(to, t);
            return (
              <g key={to}>
                <line x1={a.x} y1={a.y + 34} x2={b.x} y2={b.y - 34} className="ma-edge" />
                {on && <line x1={a.x} y1={a.y + 34} x2={b.x} y2={b.y - 34} className="ma-edge ma-edge--flow" />}
              </g>
            );
          })}
          {/* the two specialists that disagree */}
          <line x1={NODES.res.x + 70} y1={NODES.res.y} x2={NODES.cod.x - 70} y2={NODES.cod.y} className={cx("ma-edge ma-edge--peer", conflictOn(t) && "is-conflict")} />
          {conflictOn(t) && (
            <g className="ma-conflict" transform={`translate(${(NODES.res.x + NODES.cod.x) / 2}, ${NODES.res.y - 22})`}>
              <rect x="-64" y="-13" width="128" height="26" rx="13" />
              <text textAnchor="middle" y="4">Conflict: 14% vs 11%</text>
            </g>
          )}

          {(Object.keys(NODES) as NodeId[]).map((id) => {
            const n = NODES[id];
            const s = stateOf(id, t);
            return (
              <g key={id} transform={`translate(${n.x - 70}, ${n.y - 34})`} className={cx("ma-node", `is-${s}`, sel === id && "is-sel", id === "sup" && conflictOn(t) && "is-reconcile")}>
                <foreignObject width="140" height="68">
                  <button type="button" className="ma-node-btn" onClick={() => setSel(id)} aria-pressed={sel === id} aria-label={`${n.name}: ${s}`}>
                    <span className="ma-node-name">{n.name}</span>
                    <span className="ma-node-state">
                      {s === "working" && <StepStatusIcon status="active" />}
                      {s === "done" && <StepStatusIcon status="done" />}
                      {s === "waiting" && <StepStatusIcon status="pending" />}
                      {id === "sup" && conflictOn(t) ? "Reconciling" : s === "idle" ? "Idle" : s === "working" ? "Working" : s === "waiting" ? "Waiting" : "Done"}
                    </span>
                  </button>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {conflictOn(t) && (
          <p className="ma-banner lab-in" role="status">
            <Badge tone="warn">Paused to reconcile</Badge>
            <span className="lab-small">Research and Code disagree. The supervisor is checking both before presenting anything.</span>
          </p>
        )}
        {t < 0 && <p className="lab-small lab-muted">Press Run. Click any node, at any time, to read what it was asked and what it returned.</p>}
      </Panel>

      <div className="lab-stack">
        <Panel title={`${NODES[sel].name} transcript`} aside={<span className="lab-small lab-muted">{NODES[sel].role}</span>}>
          {events.length === 0 ? (
            <p className="lab-small lab-muted">Nothing yet for this agent.</p>
          ) : (
            <ul className="ma-log">
              {events.map((e, i) => (
                <li key={i} className={cx("lab-in", `is-${e.kind}`)}>
                  <span className="lab-mono lab-muted">{(e.at / 1000).toFixed(1)}s</span>
                  <span>{e.text}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {done && (
          <Panel title="Final answer" className="ma-final">
            <div className="lab-in lab-stack">
              <p className="ma-ans">
                Reported growth was <strong>14%</strong>
                <span className="ma-tag is-res">Research</span> which includes a one-off licence deal. Excluding it, underlying growth was <strong>11%</strong>
                <span className="ma-tag is-cod">Code</span>.
              </p>
              <p className="lab-small lab-muted">
                Each figure is attributed to the specialist that produced it, not paraphrased by the supervisor. That avoids the telephone game, where a summary quietly changes the number.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
