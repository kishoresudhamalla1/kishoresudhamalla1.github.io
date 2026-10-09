/**
 * Shared primitives for the AI Labs demos: status pill, step icons, diff view,
 * citation chip, buttons, toasts. Colour meaning is fixed across all twelve:
 *   indigo  the agent is acting
 *   teal    the person's own input and choices
 *   amber   waiting on a person (deliberately louder than "thinking")
 *   red     failed or destructive
 */
import { useCallback, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { RunStatus, StepKind, StepStatus } from "./useMockAgent";
import "./tokens.css";

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

export function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/* ── icons ─────────────────────────────────────────────────────────────── */
const PATHS: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  read: (
    <>
      <path d="M7 3h7l4 4v14H7z" />
      <path d="M14 3v4h4M9.5 12h5M9.5 16h5" />
    </>
  ),
  write: <path d="m4 20 1-4L16.5 4.5a2 2 0 0 1 3 3L8 19zM14 7l3 3" />,
  "call-tool": <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
  "wait-approval": (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  wait: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
    </>
  ),
};

export function KindGlyph({ kind, size = 16 }: { kind: StepKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[kind]}
    </svg>
  );
}

export function Icon({ name, size = 16 }: { name: StepKind | "check" | "x" | "chevron" | "stop" | "send" | "pause" | "play" | "undo" | "plus" | "trash" | "drag" | "lock" | "user" | "spark"; size?: number }) {
  const extra: Record<string, ReactNode> = {
    check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
    x: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" />,
    send: <path d="M4 12 20 4l-5 16-3-7z" />,
    pause: <path d="M9 6v12M15 6v12" />,
    play: <path d="M8 5v14l11-7z" />,
    undo: <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 0 12" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" />,
    drag: <path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" />,
    lock: (
      <>
        <rect x="6" y="11" width="12" height="9" rx="2" />
        <path d="M9 11V8a3 3 0 0 1 6 0v3" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20a7 7 0 0 1 14 0" />
      </>
    ),
    spark: <path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />,
  };
  const node = extra[name as string] ?? PATHS[name as string];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {node}
    </svg>
  );
}

/** Per-step status mark: its own state machine, not one global "working" flag. */
export function StepStatusIcon({ status }: { status: StepStatus }) {
  return (
    <span className={cx("lab-sicon", `lab-sicon--${status}`)} role="img" aria-label={status}>
      {status === "done" && <Icon name="check" size={12} />}
      {status === "failed" && <Icon name="x" size={12} />}
      {status === "blocked" && <Icon name="lock" size={11} />}
      {status === "skipped" && <span className="lab-sicon-dash" />}
    </span>
  );
}

/** Run-level indicator. Waiting is louder than thinking on purpose. */
export type IndicatorState = "queued" | "thinking" | "streaming" | "waiting" | "done" | "paused" | "cancelled" | "failed";

export const INDICATOR_COPY: Record<IndicatorState, { label: string; hint: string }> = {
  queued: { label: "Queued", hint: "Waiting for a free worker." },
  thinking: { label: "Thinking", hint: "Planning and calling tools." },
  streaming: { label: "Writing", hint: "The answer is arriving." },
  waiting: { label: "Waiting for you", hint: "Nothing continues until you decide." },
  done: { label: "Done", hint: "Finished with a result." },
  paused: { label: "Paused", hint: "Held by you. Resume any time." },
  cancelled: { label: "Stopped", hint: "Stopped. What was produced is kept." },
  failed: { label: "Needs attention", hint: "Stopped on a failure. Choose a way forward." },
};

export function StatusPill({ state, label }: { state: IndicatorState; label?: string }) {
  return (
    <span className={cx("lab-pill", `lab-pill--${state}`)} role="status">
      <span className="lab-pill-mark" aria-hidden="true">
        {state === "done" && <Icon name="check" size={11} />}
        {state === "paused" && <Icon name="pause" size={11} />}
        {state === "cancelled" && <Icon name="stop" size={9} />}
        {state === "failed" && <Icon name="x" size={11} />}
      </span>
      {label ?? INDICATOR_COPY[state].label}
    </span>
  );
}

export function runToIndicator(s: RunStatus): IndicatorState {
  switch (s) {
    case "queued":
      return "queued";
    case "running":
      return "thinking";
    case "waiting":
      return "waiting";
    case "paused":
      return "paused";
    case "done":
      return "done";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "queued";
  }
}

/* ── controls ──────────────────────────────────────────────────────────── */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "agent" | "danger" | "ghost";
  size?: "sm" | "md";
};
export function Button({ variant = "default", size = "md", className, ...rest }: BtnProps) {
  return <button type="button" className={cx("lab-btn", `lab-btn--${variant}`, `lab-btn--${size}`, className)} {...rest} />;
}

export function Chip({ active, tone, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: "user" | "agent" }) {
  return (
    <button type="button" className={cx("lab-chip", active && "is-active", tone && `lab-chip--${tone}`)} {...rest}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="lab-seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={cx("lab-seg-i", value === o.id && "is-active")}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Kv({ data }: { data: Record<string, string> }) {
  return (
    <dl className="lab-kv">
      {Object.entries(data).map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "agent" | "user" | "warn" | "ok" | "danger"; children: ReactNode }) {
  return <span className={cx("lab-badge", `lab-badge--${tone}`)}>{children}</span>;
}

/* ── toast ─────────────────────────────────────────────────────────────── */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  useEffect(() => () => void (t.current && clearTimeout(t.current)), []);
  const node = (
    <div className="lab-toast-region" aria-live="polite">
      {msg && <div className="lab-toast">{msg}</div>}
    </div>
  );
  return { show, node };
}

/* ── citations ─────────────────────────────────────────────────────────── */
export function CitationChip({
  n,
  active,
  onToggle,
  children,
}: {
  n: number;
  active?: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <span className="lab-cite-wrap">
      <button
        type="button"
        className={cx("lab-cite", active && "is-active")}
        aria-expanded={!!active}
        aria-label={`Source ${n}`}
        onClick={() => !active && onToggle()}
        onMouseEnter={() => !active && onToggle()}
      >
        {n}
      </button>
      {active && children}
    </span>
  );
}

/* ── diff ──────────────────────────────────────────────────────────────── */
type Part = { t: "same" | "del" | "ins"; v: string };

export function wordDiff(a: string, b: string): Part[] {
  const x = a.split(/(\s+)/).filter(Boolean);
  const y = b.split(/(\s+)/).filter(Boolean);
  const m = x.length;
  const n = y.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Part[] = [];
  let i = 0;
  let j = 0;
  const push = (t: Part["t"], v: string) => {
    const last = out[out.length - 1];
    if (last && last.t === t) last.v += v;
    else out.push({ t, v });
  };
  while (i < m && j < n) {
    if (x[i] === y[j]) {
      push("same", x[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", x[i++]);
    else push("ins", y[j++]);
  }
  while (i < m) push("del", x[i++]);
  while (j < n) push("ins", y[j++]);
  return out;
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const parts = wordDiff(before, after);
  return (
    <p className="lab-diff">
      {parts.map((p, i) => (
        <span key={i} className={p.t === "del" ? "lab-del" : p.t === "ins" ? "lab-ins" : undefined}>
          {p.v}
        </span>
      ))}
    </p>
  );
}

/** A card-like surface used by every demo. */
export function Panel({ title, aside, children, className }: { title?: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx("lab-panel", className)}>
      {(title || aside) && (
        <header className="lab-panel-h">
          {title && <h3>{title}</h3>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}
