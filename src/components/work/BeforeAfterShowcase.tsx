import { useCallback, useRef, useState } from "react";
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
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.min(100, Math.max(0, next)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
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
      <div className="bas-layer bas-layer--before">
        {beforeSrc ? (
          <img src={beforeSrc} alt="Claude's first raw draft of the Agent Control Plane" draggable={false} />
        ) : (
          <WireframeDraft />
        )}
        <span className="bas-badge bas-badge--before">Before &middot; Claude draft 1 (raw output)</span>
      </div>

      <div className="bas-layer bas-layer--after" style={{ clipPath: `inset(0 0 0 ${pct}%)` }}>
        {afterSrc ? (
          <img src={afterSrc} alt="My final production Agent Control Plane UI" draggable={false} />
        ) : (
          <WireframeFinal />
        )}
        <span className="bas-badge bas-badge--after">After &middot; Principal design refinement</span>

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

      <div className="bas-handle" style={{ left: `${pct}%` }}>
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
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6-6 6 6 6M15 6l6 6-6 6"/></svg>
        </div>
      </div>
    </div>
  );
}

function WireframeDraft() {
  return (
    <svg className="bas-wire" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="250" fill="var(--color-surface)" />
      {Array.from({ length: 7 }).map((_, i) => (
        <rect key={i} x="16" y={16 + i * 32} width="368" height="24" rx="3" fill="var(--color-border)" />
      ))}
    </svg>
  );
}

function WireframeFinal() {
  return (
    <svg className="bas-wire" viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="400" height="250" fill="var(--color-surface)" />
      <rect x="16" y="16" width="110" height="218" rx="6" fill="var(--color-border)" />
      <rect x="140" y="16" width="244" height="64" rx="6" fill="color-mix(in srgb, #4f8a7c 20%, var(--color-border))" />
      <rect x="140" y="92" width="244" height="46" rx="6" fill="var(--color-border)" />
      <rect x="140" y="150" width="244" height="84" rx="6" fill="color-mix(in srgb, #c17a4a 18%, var(--color-border))" />
    </svg>
  );
}
