import { useEffect, useRef, useState } from "react";
import { Badge, Button, DiffView, Icon, Panel, StepStatusIcon, cx } from "../_shared/ui";
import "./styles.css";

type Op = "shorten" | "rewrite" | "formal" | "casual";

const INITIAL = [
  "We’re really excited to share that the new Insights dashboard is live for every team today. It’s the first release built entirely on the feedback you sent us over the last two quarters.",
  "With Insights, you can see delivery risk, workload and approvals in one place, and it just works with the tools your teams already use. Setup takes about ten minutes and doesn’t need an admin.",
  "We’d love to hear what you think. Reply to this email or drop a note in the feedback channel, and we’ll read every message.",
];

const SYN: [RegExp, string][] = [
  [/\blive\b/gi, "available"],
  [/\bshare\b/gi, "announce"],
  [/\bsee\b/gi, "track"],
  [/\bhear\b/gi, "learn"],
  [/\bsetup\b/gi, "Set up"],
  [/\bnote\b/gi, "message"],
];
const FORMAL: [RegExp, string][] = [
  [/We’re/g, "We are"], [/It’s/g, "It is"], [/doesn’t/g, "does not"], [/We’d/g, "We would"], [/we’ll/g, "we will"],
  [/\breally excited\b/gi, "pleased"], [/\bjust works\b/gi, "integrates"], [/\bdrop a note\b/gi, "send a message"], [/\bReply\b/g, "Please reply"],
];
const CASUAL: [RegExp, string][] = [
  [/We are/g, "We’re"], [/It is/g, "It’s"], [/does not/g, "doesn’t"], [/We would/g, "We’d"], [/we will/g, "we’ll"],
  [/\bpleased\b/gi, "pumped"], [/\bintegrates\b/gi, "just works"],
];

function sub(s: string, rules: [RegExp, string][]) {
  return rules.reduce((acc, [re, to]) => acc.replace(re, to), s);
}
function transform(s: string, op: Op): string {
  let out = s;
  if (op === "formal") out = sub(s, FORMAL);
  else if (op === "casual") out = sub(s, CASUAL);
  else if (op === "rewrite") {
    out = sub(s, SYN);
    if (out === s) out = "In short: " + s.charAt(0).toLowerCase() + s.slice(1);
  } else {
    const t = s.replace(/\b(really|very|just|quite|simply|entirely)\s+/gi, "").replace(/\s*\([^)]*\)/g, "");
    out = t.length > 60 ? t.split(/, | and | over /)[0].trim() + (/[.!?]$/.test(t) ? "" : ".") : t;
    if (!/[.!?]$/.test(out)) out += ".";
  }
  return out;
}

const OP_LABEL: Record<Op, string> = { shorten: "Shortened", rewrite: "Rewrote", formal: "Made more formal", casual: "Made friendlier" };

interface Version {
  label: string;
  paras: string[];
  changed: number[];
  prev: string[] | null;
}

function parseOp(text: string): Op {
  const t = text.toLowerCase();
  if (/formal|professional/.test(t)) return "formal";
  if (/short|concise|trim|cut/.test(t)) return "shorten";
  if (/friend|casual|warm|chatty|relaxed/.test(t)) return "casual";
  return "rewrite";
}

export default function EditableOutputs() {
  const [versions, setVersions] = useState<Version[]>([{ label: "First draft", paras: INITIAL, changed: [], prev: null }]);
  const [cur, setCur] = useState(0);
  const [chat, setChat] = useState<{ who: "you" | "agent"; text: string }[]>([
    { who: "agent", text: "Here is a first draft. Select any sentence to refine just that passage, or use Edit to change the whole document." },
  ]);
  const [pop, setPop] = useState<{ i: number; text: string; x: number; y: number } | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [busy, setBusy] = useState<number[] | null>(null);
  const [flash, setFlash] = useState<{ i: number; text: string } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [instr, setInstr] = useState("");
  const [chatText, setChatText] = useState("");
  const box = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const v = versions[cur];
  const parasNow = v.paras;

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [chat]);

  const commit = (label: string, paras: string[], changed: number[], message: string, flashed?: { i: number; text: string }) => {
    const next = [...versions.slice(0, cur + 1), { label, paras, changed, prev: parasNow }];
    setVersions(next);
    setCur(next.length - 1);
    setChat((c) => [...c, { who: "agent", text: message }]);
    setBusy(null);
    if (flashed) {
      setFlash(flashed);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setFlash(null), 2600);
    }
  };

  const applyToSelection = (op: Op) => {
    if (!pop) return;
    const { i, text } = pop;
    setPop(null);
    setToneOpen(false);
    window.getSelection()?.removeAllRanges();
    setChat((c) => [...c, { who: "you", text: `${OP_LABEL[op]} this passage: “${text.length > 46 ? text.slice(0, 46) + "…" : text}”` }]);
    setBusy([i]);
    setTimeout(() => {
      const replacement = transform(text, op);
      const paras = parasNow.map((p, k) => (k === i ? p.replace(text, replacement) : p));
      commit(`${OP_LABEL[op]} paragraph ${i + 1}`, paras, [i], `Done. Only paragraph ${i + 1} changed. The rest of the document is untouched.`, { i, text: replacement });
    }, 900);
  };

  const applyToDoc = (instruction: string) => {
    const text = instruction.trim();
    if (!text) return;
    const op = parseOp(text);
    setChat((c) => [...c, { who: "you", text }]);
    setEditOpen(false);
    setInstr("");
    setChatText("");
    const target = parasNow.map((_, i) => i);
    setBusy(target);
    setTimeout(() => {
      const paras = parasNow.map((p) => transform(p, op));
      const changed = paras.map((p, i) => (p !== parasNow[i] ? i : -1)).filter((i) => i >= 0);
      commit(
        OP_LABEL[op],
        paras,
        changed,
        changed.length ? `${OP_LABEL[op]}. ${changed.length} of ${parasNow.length} paragraphs changed. Open the version strip to see exactly what.` : "Nothing needed changing for that instruction.",
      );
    }, 1100);
  };

  const onSelect = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !box.current) return setPop(null);
    const node = sel.anchorNode?.nodeType === 3 ? sel.anchorNode.parentElement : (sel.anchorNode as HTMLElement | null);
    const p = node?.closest<HTMLElement>("[data-i]");
    const text = sel.toString().trim();
    if (!p || !text || !box.current.contains(p)) return setPop(null);
    const i = Number(p.dataset.i);
    if (!parasNow[i].includes(text)) return setPop(null);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    const b = box.current.getBoundingClientRect();
    setPop({ i, text, x: Math.max(8, Math.min(r.left - b.left + r.width / 2, b.width - 8)), y: r.top - b.top });
    setToneOpen(false);
  };

  const render = (p: string, i: number) => {
    if (flash && flash.i === i && p.includes(flash.text)) {
      const at = p.indexOf(flash.text);
      return (
        <>
          {p.slice(0, at)}
          <mark className="ed-new">{flash.text}</mark>
          {p.slice(at + flash.text.length)}
        </>
      );
    }
    return p;
  };

  return (
    <div className="ed-grid">
      <Panel title="Chat" className="ed-chat">
        <div className="ed-log" ref={log} aria-live="polite">
          {chat.map((m, i) => (
            <div key={i} className={cx("ed-msg lab-in", m.who === "you" ? "is-you" : "is-agent")}>
              <span className="lab-mono lab-muted">{m.who === "you" ? "You" : "Agent"}</span>
              <p>{m.text}</p>
            </div>
          ))}
          {busy && (
            <div className="ed-msg is-agent lab-in"><span className="lab-mono lab-muted">Agent</span><p className="ed-working"><StepStatusIcon status="active" /> Editing {busy.length === 1 ? `paragraph ${busy[0] + 1}` : "the document"}</p></div>
          )}
        </div>
        <form className="ed-chatform" onSubmit={(e) => { e.preventDefault(); applyToDoc(chatText); }}>
          <input className="lab-input" value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Ask for a change" aria-label="Ask for a change" disabled={!!busy} />
          <Button variant="agent" type="submit" size="sm" disabled={!!busy}><Icon name="send" size={12} /></Button>
        </form>
      </Panel>

      <div className="ed-doc-wrap">
        <Panel
          title="Document"
          aside={<Button size="sm" onClick={() => setEditOpen(!editOpen)} disabled={!!busy}><Icon name="write" size={13} />Edit</Button>}
        >
          {editOpen && (
            <form className="ed-edit lab-in" onSubmit={(e) => { e.preventDefault(); applyToDoc(instr); }}>
              <input className="lab-input" autoFocus value={instr} onChange={(e) => setInstr(e.target.value)} placeholder="Make this more formal" aria-label="Whole-document instruction" />
              <div className="lab-row">
                {["Make this more formal", "Make it shorter", "Make it friendlier"].map((s) => (
                  <button type="button" key={s} className="lab-chip lab-chip--user" onClick={() => applyToDoc(s)}>{s}</button>
                ))}
              </div>
            </form>
          )}

          <div className="ed-doc" ref={box} onMouseUp={onSelect} onKeyUp={onSelect}>
            <h4 className="ed-title">Introducing Insights</h4>
            {parasNow.map((p, i) => (
              <p key={i} data-i={i} className={cx("ed-p", busy?.includes(i) && "is-busy", v.changed.includes(i) && cur > 0 && "is-changed")}>
                {render(p, i)}
              </p>
            ))}

            {pop && (
              <div className="ed-pop lab-in" style={{ left: pop.x, top: pop.y }} role="toolbar" aria-label="Edit selection" onMouseDown={(e) => e.preventDefault()}>
                {!toneOpen ? (
                  <>
                    <button type="button" onClick={() => applyToSelection("shorten")}>Shorten</button>
                    <button type="button" onClick={() => applyToSelection("rewrite")}>Rewrite</button>
                    <button type="button" onClick={() => setToneOpen(true)}>Adjust tone</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => applyToSelection("formal")}>More formal</button>
                    <button type="button" onClick={() => applyToSelection("casual")}>Friendlier</button>
                    <button type="button" onClick={() => setToneOpen(false)} aria-label="Back">Back</button>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="lab-small lab-muted">Select a sentence to get inline actions. Only the section you touch re-renders.</p>
        </Panel>

        <Panel title="Version history" aside={<Badge tone="neutral">{versions.length} versions</Badge>}>
          <ol className="ed-strip" aria-label="Versions">
            {versions.map((x, i) => (
              <li key={i}>
                <button type="button" className={cx("ed-dot", i === cur && "is-active")} onClick={() => setCur(i)} aria-label={`Go to version ${i + 1}: ${x.label}`} aria-current={i === cur} />
                <span className="ed-dot-label">{x.label}</span>
              </li>
            ))}
          </ol>
          {cur > 0 && v.prev ? (
            <div className="ed-changes lab-in">
              <p className="lab-small"><strong>What changed in “{v.label}”</strong></p>
              {v.changed.map((i) => (
                <DiffView key={i} before={v.prev![i]} after={v.paras[i]} />
              ))}
            </div>
          ) : (
            <p className="lab-small lab-muted">The first draft. Make an edit, then click any dot to travel back. Nothing is silently lost.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
