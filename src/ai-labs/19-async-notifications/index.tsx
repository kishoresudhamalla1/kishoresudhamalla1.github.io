import { useState } from "react";
import { Badge, Button, Icon, Panel, cx, useToast } from "../_shared/ui";
import "./styles.css";

type Channel = "app" | "push" | "email";

interface Item {
  id: string;
  title: string;
  summary: string;
  time: string;
  channel: Channel;
  state: "done" | "failed" | "waiting";
  recurring?: boolean;
}

const DIGEST: Item[] = [
  { id: "a", title: "Overtime audit", summary: "38 timesheets checked. 3 entries need manager review.", time: "9m ago", channel: "push", state: "done", recurring: true },
  { id: "b", title: "Policy sync", summary: "Confluence couldn't be reached. Retried twice, then gave up.", time: "9m ago", channel: "push", state: "failed" },
  { id: "c", title: "Overtime reconciliation", summary: "3 employees are over the 10-hour threshold this month.", time: "8m ago", channel: "push", state: "done" },
];

const IMMEDIATE: Item = {
  id: "d",
  title: "Leave balance report",
  summary: "Exported for all 40 employees. Ready to download.",
  time: "just now",
  channel: "app",
  state: "done",
};

const CHANNEL_LABEL: Record<Channel, string> = { app: "In-app only", push: "Push", email: "Email" };

function Row({ item, onMute }: { item: Item; onMute?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className={cx("an-row", item.state === "failed" && "is-failed")}>
      <button type="button" className="an-row-h" onClick={() => setOpen(!open)} aria-expanded={open}>
        {item.state === "done" && <span className="an-dot an-dot--ok" aria-hidden="true" />}
        {item.state === "failed" && <span className="an-dot an-dot--bad" aria-hidden="true" />}
        {item.state === "waiting" && <span className="an-dot an-dot--wait" aria-hidden="true" />}
        <span className="lab-grow an-row-t">{item.title}</span>
        <Badge tone="neutral">{CHANNEL_LABEL[item.channel]}</Badge>
        <span className="lab-mono lab-muted an-time">{item.time}</span>
      </button>
      {open && (
        <div className="an-detail lab-in">
          <p>{item.summary}</p>
          {item.recurring && onMute && (
            <button type="button" className="an-mute" onClick={onMute}>Mute this task's notifications</button>
          )}
        </div>
      )}
    </li>
  );
}

export default function AsyncNotifications() {
  const [digestOpen, setDigestOpen] = useState(false);
  const [muted, setMuted] = useState<string[]>([]);
  const [channels, setChannels] = useState<Record<Channel, boolean>>({ app: true, push: true, email: false });
  const { show, node } = useToast();

  const toggleChannel = (c: Channel) => {
    setChannels((s) => ({ ...s, [c]: !s[c] }));
    show(`${CHANNEL_LABEL[c]} notifications ${channels[c] ? "turned off" : "turned on"}`);
  };
  const mute = (id: string, title: string) => {
    setMuted((m) => [...m, id]);
    show(`Muted: ${title}. The task keeps running, it just won't notify you again.`);
  };

  return (
    <div className="lab-stack">
      {node}
      <Panel title="Notifications">
        <ul className="an-list">
          <Row item={IMMEDIATE} />
        </ul>

        <button type="button" className="an-digest" onClick={() => setDigestOpen(!digestOpen)} aria-expanded={digestOpen}>
          <span className={cx("an-chev", digestOpen && "is-open")}><Icon name="chevron" size={13} /></span>
          3 updates from while you were away
          <span className="lab-grow" />
          <span className="lab-muted">away for 22 minutes</span>
        </button>
        {digestOpen && (
          <ul className="an-list lab-in">
            {DIGEST.filter((d) => !muted.includes(d.id)).map((d) => (
              <Row key={d.id} item={d} onMute={() => mute(d.id, d.title)} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Notify me by">
        <div className="lab-row">
          {(Object.keys(CHANNEL_LABEL) as Channel[]).map((c) => (
            <label key={c} className="an-check">
              <input type="checkbox" checked={channels[c]} onChange={() => toggleChannel(c)} />
              {CHANNEL_LABEL[c]}
            </label>
          ))}
        </div>
      </Panel>
    </div>
  );
}
