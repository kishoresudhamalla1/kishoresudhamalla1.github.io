import { useCallback, useEffect, useRef, useState } from "react";
import "./work-interactive.css";

interface Pin {
  x: number; // percent, within the after layer
  y: number; // percent
  label: string;
}

interface Props {
  beforeSrc?: string;
  afterSrc?: string;
  pins: Pin[];
}

/** Zero-dependency drag slider: two stacked screenshots, a clip-path reveal, no library. */
export function BeforeAfterShowcase({ beforeSrc, afterSrc, pins }: Props) {
  const [pct, setPct] = useState(50);
  const [activePin, setActivePin] = useState<number | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [animating, setAnimating] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // A one-time intro sweep: proves the frame is draggable before anyone touches it.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnimating(false);
      return;
    }
    const steps: [number, number][] = [[260, 22], [850, 78], [1250, 50]];
    const timers = steps.map(([delay, value]) => window.setTimeout(() => setPct(value), delay));
    const stop = window.setTimeout(() => setAnimating(false), 1500);
    return () => { timers.forEach(clearTimeout); clearTimeout(stop); };
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, next)));
  }, []);

  const endIntro = () => { setAnimating(false); setInteracted(true); };

  const onPointerDown = (e: React.PointerEvent) => {
    endIntro();
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    endIntro();
    if (e.key === "ArrowLeft") setPct((p) => Math.max(0, p - 4));
    if (e.key === "ArrowRight") setPct((p) => Math.min(100, p + 4));
  };

  return (
    <div
      ref={frameRef}
      className="bas-frame"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={`bas-layer bas-layer--before${animating ? " is-animating" : ""}`}>
        {beforeSrc ? (
          <img src={beforeSrc} alt="Claude's first raw draft of the Agent Control Plane" draggable={false} />
        ) : (
          <WireframeDraft />
        )}
      </div>

      <div
        className={`bas-layer bas-layer--after${animating ? " is-animating" : ""}`}
        style={{ clipPath: `inset(0 0 0 ${pct}%)` }}
      >
        {afterSrc ? (
          <img src={afterSrc} alt="My final production Agent Control Plane UI" draggable={false} />
        ) : (
          <WireframeFinal />
        )}

        {pins.map((p, i) => (
          <button
            type="button"
            key={i}
            className="bas-pin"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerEnter={() => setActivePin(i)}
            onPointerLeave={() => setActivePin((cur) => (cur === i ? null : cur))}
            onClick={(e) => { e.stopPropagation(); setActivePin((cur) => (cur === i ? null : i)); }}
            aria-label={`Pin ${i + 1}: ${p.label}`}
          >
            {i + 1}
            {activePin === i && <span className="bas-tip">{p.label}</span>}
          </button>
        ))}
      </div>

      {/* Labels live outside both clipped layers so they never overlap the
          screenshot content; each crossfades out as its own side shrinks. */}
      <div className="bas-labels" aria-hidden="true">
        <span className="bas-badge bas-badge--before" style={{ opacity: Math.min(1, pct / 18) }}>
          Before &middot; Claude draft 1 (raw output)
        </span>
        <span className="bas-badge bas-badge--after" style={{ opacity: Math.min(1, (100 - pct) / 18) }}>
          After &middot; Principal design refinement
        </span>
      </div>

      {!interacted && (
        <span className="bas-hint">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 7-5 5 5 5M15 7l5 5-5 5"/></svg>
          Drag to compare
        </span>
      )}

      <div className={`bas-handle${animating ? " is-animating" : ""}`} style={{ left: `${pct}%` }}>
        <div className="bas-handle-line" />
        <div
          className="bas-handle-thumb"
          tabIndex={0}
          role="slider"
          aria-label="Before and after comparison"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          onKeyDown={onKeyDown}
          onPointerDown={endIntro}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6"/></svg>
        </div>
      </div>
    </div>
  );
}

function WireframeDraft() {
  return (
    <svg className="bas-wire" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width="400" height="250" fill="var(--color-surface)" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="16" y={16 + i * 32} width="368" height="24" rx="3" fill="var(--color-border)" />
      ))}
    </svg>
  );
}

function WireframeFinal() {
  return (
    <svg className="bas-wire" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect width="400" height="250" fill="var(--color-surface)" />
      <rect x="16" y="16" width="110" height="218" rx="6" fill="var(--color-border)" />
      <rect x="140" y="16" width="244" height="64" rx="6" fill="color-mix(in srgb, #4f8a7c 20%, var(--color-border))" />
      <rect x="140" y="92" width="244" height="46" rx="6" fill="var(--color-border)" />
      <rect x="140" y="150" width="244" height="84" rx="6" fill="color-mix(in srgb, #c17a4a 18%, var(--color-border))" />
    </svg>
  );
}
