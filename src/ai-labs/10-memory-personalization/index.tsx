import { useMemo, useRef, useState } from "react";
import { uid } from "../_shared/useMockAgent";
import { Badge, Button, Icon, Panel, Segmented, cx, useToast } from "../_shared/ui";
import "./styles.css";

type Origin = "declared" | "inferred";
interface Memory {
  id: string;
  text: string;
  origin: Origin;
  because: string;
  key?: "veg" | "short" | "tz" | "run" | "dog";
}

const START: Memory[] = [
  { id: "m1", text: "I’m vegetarian", origin: "declared", because: "You told me on 12 Sep", key: "veg" },
  { id: "m2", text: "Prefers short answers", origin: "declared", because: "You told me on 3 Oct", key: "short" },
  { id: "m3", text: "Has a dog called Miso", origin: "declared", because: "You told me on 20 Sep", key: "dog" },
  { id: "m4", text: "Works on Berlin time", origin: "inferred", because: "Inferred from 9 calendar invites", key: "tz" },
  { id: "m5", text: "Is training for a marathon", origin: "inferred", because: "Inferred from 5 conversations about running", key: "run" },
  { id: "m6", text: "Likes meetings before 11am", origin: "inferred", because: "Inferred from how you accepted invites" },
];

type Filter = "all" | Origin;

function preview(mem: Memory[]) {
  const has = (k: NonNullable<Memory["key"]>) => mem.some((m) => m.key === k);
  const lines: { id: string; text: string }[] = [];
  lines.push({ id: "tz", text: has("tz") ? "Everything below is in Berlin time." : "Times are shown in UTC. Tell me your timezone if you want them local." });
  lines.push({ id: "run", text: has("run") ? "8:00  Easy 8 km run, week 6 of your marathon plan." : "8:00  Start the morning however you like. I can suggest a workout if you want one." });
  lines.push({ id: "dog", text: has("dog") ? "11:00  Walk Miso in the park before the afternoon rain." : "11:00  A walk before the afternoon rain." });
  lines.push({ id: "veg", text: has("veg") ? "13:00  Lunch: the lentil and spinach bowl at the market." : "13:00  Lunch: any stall at the market, the burger place is quickest." });
  mem.filter((m) => !m.key && m.id.startsWith("u")).forEach((m) => lines.push({ id: m.id, text: `Also keeping in mind: ${m.text.toLowerCase()}.` }));
  if (!has("short")) lines.push({ id: "long", text: "A note on the plan: I ordered the day so the run comes first, while your energy is highest, and left the afternoon open in case the rain changes things." });
  return lines;
}

export default function MemoryPersonalization() {
  const [mem, setMem] = useState<Memory[]>(START);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState("");
  const [changed, setChanged] = useState<string | null>(null);
  const { show, node } = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(
    () => mem.filter((m) => (filter === "all" || m.origin === filter) && m.text.toLowerCase().includes(q.toLowerCase())),
    [mem, q, filter]
  );
  const lines = useMemo(() => preview(mem), [mem]);

  const flag = (id: string) => {
    setChanged(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setChanged(null), 1800);
  };

  const remove = (m: Memory, stopInferring = false) => {
    setMem((x) => x.filter((y) => y.id !== m.id));
    flag(m.key ?? "long");
    show(
      m.origin === "inferred"
        ? stopInferring
          ? `Future answers won’t assume “${m.text.toLowerCase()}” anymore, and I won’t infer it again.`
          : `Forgotten. Future answers won’t use “${m.text.toLowerCase()}”.`
        : `Deleted. Future answers won’t use “${m.text.toLowerCase()}”.`
    );
  };

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const m: Memory = { id: uid("u"), text, origin: "declared", because: "You told me just now" };
    setMem((x) => [m, ...x]);
    setDraft("");
    flag(m.id);
    show("Saved. I’ll use this in future answers.");
  };

  return (
    <div className="mp-grid">
      {node}
      <Panel title="What I remember about you" aside={<Badge tone="neutral">{mem.length} items</Badge>}>
        <div className="mp-tools">
          <input className="lab-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memories" aria-label="Search memories" />
          <Segmented<Filter>
            label="Filter by origin"
            value={filter}
            onChange={setFilter}
            options={[{ id: "all", label: "All" }, { id: "declared", label: "Declared" }, { id: "inferred", label: "Inferred" }]}
          />
        </div>

        <ul className="mp-list">
          {visible.map((m) => (
            <li key={m.id} className={cx("mp-item lab-in", `is-${m.origin}`)}>
              <div className="lab-grow">
                <div className="lab-row">
                  <strong>{m.text}</strong>
                  <Badge tone={m.origin === "declared" ? "user" : "agent"}>{m.origin === "declared" ? "Declared" : "Inferred"}</Badge>
                </div>
                <span className="lab-small lab-muted">{m.because}</span>
              </div>
              <div className="lab-row">
                {m.origin === "inferred" && (
                  <Button size="sm" variant="primary" onClick={() => remove(m, true)} title="Remove it and stop the system concluding it again">
                    Stop assuming this
                  </Button>
                )}
                <Button size="sm" variant={m.origin === "inferred" ? "ghost" : "danger"} onClick={() => remove(m)} aria-label={`Delete ${m.text}`}>
                  <Icon name="trash" size={13} />{m.origin === "declared" ? "Delete" : ""}
                </Button>
              </div>
            </li>
          ))}
          {visible.length === 0 && <li className="lab-small lab-muted">{mem.length === 0 ? "Nothing is remembered. Answers will be generic." : "No matches."}</li>}
        </ul>

        <form className="mp-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <input className="lab-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add something you want me to remember" aria-label="Add a memory" />
          <Button type="submit" variant="agent" size="sm"><Icon name="plus" size={12} />Remember</Button>
        </form>
      </Panel>

      <Panel title="Proof it changes behaviour" aside={<span className="lab-small lab-muted">“Plan my Saturday”</span>}>
        <ul className="mp-preview" aria-live="polite">
          {lines.map((l) => (
            <li key={l.id} className={cx(changed === l.id && "is-changed")}>{l.text}</li>
          ))}
        </ul>
        <p className="lab-small lab-muted mp-foot">
          Delete or add a memory and watch this answer change. Inferred and declared memories are treated differently on purpose. A wrong guess needs “stop assuming”, a wrong fact just needs deleting.
        </p>
      </Panel>
    </div>
  );
}
