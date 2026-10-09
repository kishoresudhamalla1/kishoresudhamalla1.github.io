import { useEffect, useRef, useState } from "react";
import { Badge, Button, CitationChip, Icon, Panel, StepStatusIcon, cx, useToast } from "../_shared/ui";
import "./styles.css";

interface Source {
  n: number;
  domain: string;
  title: string;
  snippet: string;
  year: string;
  hue: number;
  usedBy: number[];
}

const SOURCES: Source[] = [
  { n: 1, domain: "workstudies.org", title: "Hybrid work across 1,600 firms", snippet: "Output per worker was within 2% between hybrid and fully onsite teams.", year: "2024", hue: 250, usedBy: [1] },
  { n: 2, domain: "econreview.com", title: "Productivity after the pandemic", snippet: "No consistent difference in measured output once role mix is controlled for.", year: "2023", hue: 170, usedBy: [1, 3] },
  { n: 3, domain: "peoplejournal.io", title: "Onboarding without an office", snippet: "New hires with fewer onsite days reported weaker ties to their team.", year: "2024", hue: 30, usedBy: [2] },
  { n: 4, domain: "labourstats.gov", title: "Quarterly productivity release", snippet: "Output per hour rose 1.2% last quarter, with no split by work location.", year: "2022", hue: 330, usedBy: [3] },
];

const CLAIMS = [
  { id: 1, text: "Hybrid and onsite teams report about the same output in most large studies.", cites: [1, 2], confidence: "high" as const },
  { id: 2, text: "Newer employees tend to feel less connected when they have fewer days in person.", cites: [3], confidence: "medium" as const },
  { id: 3, text: "The early productivity boost from remote work has faded in recent figures.", cites: [2, 4], confidence: "mixed" as const },
];

const Favicon = ({ s }: { s: Source }) => (
  <span className="tp-fav" style={{ background: `hsl(${s.hue} 55% 46%)` }} aria-hidden="true">{s.domain[0].toUpperCase()}</span>
);

export default function TransparencyProvenance() {
  const [open, setOpen] = useState<number | null>(null);
  const [process, setProcess] = useState(false);
  const [all, setAll] = useState(false);
  const [why, setWhy] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [check, setCheck] = useState<"idle" | "running" | "done">("idle");
  const answer = useRef<HTMLDivElement>(null);
  const { show, node } = useToast();

  // click anywhere else closes a source preview
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".lab-cite-wrap")) setOpen(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const onSelect = () => {
    const s = window.getSelection();
    const text = s?.toString().trim() ?? "";
    const inside = !!s?.anchorNode && !!answer.current?.contains(s.anchorNode);
    if (inside && text.length > 8) {
      setSel(text);
      setCheck("idle");
    } else if (!inside) setSel(null);
  };

  const runCheck = () => {
    setCheck("running");
    setTimeout(() => setCheck("done"), 1300);
  };

  return (
    <div className="lab-stack">
      {node}
      <Panel title="Answer">
        <p className="tp-q lab-small"><strong>Question:</strong> Is remote work still raising productivity?</p>

        {/* layer 2: the research process, collapsed by default */}
        <button type="button" className="tp-process" aria-expanded={process} onClick={() => setProcess(!process)}>
          <Icon name="check" size={13} /> Completed 3 steps
          <span className="lab-grow" />
          <span className={cx("tp-chev", process && "is-open")}><Icon name="chevron" size={13} /></span>
        </button>
        {process && (
          <ul className="tp-steps lab-in">
            <li><StepStatusIcon status="done" /> Searched 12 pages</li>
            <li><StepStatusIcon status="done" /> Read the 4 most relevant sources</li>
            <li><StepStatusIcon status="done" /> Cross-checked each claim against its sources</li>
          </ul>
        )}

        {/* layer 1: inline citation on the claim itself */}
        <div className="tp-answer" ref={answer} onMouseUp={onSelect} onKeyUp={onSelect}>
          {CLAIMS.map((c) => (
            <p key={c.id} className="tp-claim">
              {c.text}
              {c.cites.map((n) => {
                const s = SOURCES.find((x) => x.n === n)!;
                return (
                  <CitationChip key={n} n={n} active={open === n * 10 + c.id} onToggle={() => setOpen(open === n * 10 + c.id ? null : n * 10 + c.id)}>
                    <span className="tp-pop lab-in" role="dialog" aria-label={`Source ${n}`}>
                      <span className="lab-row"><Favicon s={s} /><span className="lab-mono lab-muted">{s.domain} · {s.year}</span></span>
                      <strong>{s.title}</strong>
                      <span className="lab-small">{s.snippet}</span>
                    </span>
                  </CitationChip>
                );
              })}
              {c.confidence === "mixed" && (
                <>
                  {" "}
                  <Badge tone="warn">Mixed confidence</Badge>{" "}
                  <button type="button" className="tp-why" aria-expanded={why} onClick={() => setWhy(!why)}>Why?</button>
                </>
              )}
            </p>
          ))}

          {why && (
            <div className="tp-reason lab-in" role="note">
              <p><strong>Why this one is marked mixed</strong></p>
              <ul>
                <li><Badge tone="warn">Conflicting sources</Badge> Two sources show flat results, one shows a small decline.</li>
                <li><Badge tone="warn">Stale data</Badge> The newest source is from 2022, so it predates the recent surveys.</li>
              </ul>
              <div className="lab-row">
                <Button size="sm" onClick={() => show("Opened the latest quarterly release in a new tab")}>Verify with the latest quarterly release</Button>
                <Button size="sm" variant="ghost" onClick={() => show("Re-running this claim with sources from the last 12 months")}>Re-run with newer sources</Button>
              </div>
            </div>
          )}
        </div>

        {/* layer 5: check sources, scoped to a highlighted selection */}
        {sel && (
          <div className="tp-check lab-in">
            <span className="lab-small">Selected: “{sel.length > 58 ? sel.slice(0, 58) + "…" : sel}”</span>
            {check === "idle" && <Button size="sm" variant="agent" onClick={runCheck}>Check sources for this selection</Button>}
            {check === "running" && <span className="lab-small"><StepStatusIcon status="active" /> Checking</span>}
            {check === "done" && (
              <span className="lab-small lab-in">Checked against 2 sources: 1 supports it, 1 is neutral. No source contradicts it.</span>
            )}
          </div>
        )}

        {/* layers 3 and 4: sources row, then the full audit */}
        <div className="tp-sources">
          <button type="button" className="tp-srcbtn" aria-expanded={all} onClick={() => setAll(!all)}>
            <span className="tp-stack">{SOURCES.map((s) => <Favicon key={s.n} s={s} />)}</span>
            Sources ({SOURCES.length})
          </button>
          <Button size="sm" variant="ghost" onClick={() => show("Thanks. We will review these sources and re-check the answer.")}>Wrong sources</Button>
        </div>

        {all && (
          <ul className="tp-list lab-in">
            {SOURCES.map((s) => (
              <li key={s.n}>
                <Favicon s={s} />
                <span className="lab-grow">
                  <strong>{s.title}</strong>
                  <span className="lab-small tp-meta">{s.domain} · {s.year} · supports {s.usedBy.map((c) => `claim ${c}`).join(", ")}</span>
                </span>
                <span className="lab-badge">{s.n}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="lab-small lab-muted tp-foot">Confidence is a band, never a made-up percentage, and a low band always comes with a concrete way to verify.</p>
      </Panel>
    </div>
  );
}
