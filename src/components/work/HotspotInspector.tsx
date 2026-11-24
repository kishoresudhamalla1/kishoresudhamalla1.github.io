import { useState } from "react";
import "./work-interactive.css";

export interface Pin {
  x: number; // percent, 0-100
  y: number; // percent, 0-100
  tag: string;
  title: string;
  body: string;
  tradeoff?: string;
}

interface Props {
  imageSrc: string;
  imageAlt: string;
  pins: Pin[];
}

/** Click a numbered pin on the screenshot, read the matching decision on the right. */
export function HotspotInspector({ imageSrc, imageAlt, pins }: Props) {
  const [active, setActive] = useState(0);
  const pin = pins[active];

  return (
    <div className="hs">
      <div className="hs-shot">
        <img src={imageSrc} alt={imageAlt} loading="lazy" />
        {pins.map((p, i) => (
          <button
            key={i}
            type="button"
            className="hs-pin"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-pressed={i === active}
            aria-label={`Pin ${i + 1}: ${p.title}`}
            onClick={() => setActive(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="hs-panel">
        <p className="hs-panel-tag">Pin {active + 1} &middot; {pin.tag}</p>
        <h3 className="hs-panel-title">{pin.title}</h3>
        <p className="hs-panel-body">{pin.body}</p>
        {pin.tradeoff && (
          <div className="hs-panel-tradeoff">
            <p className="hs-panel-tradeoff-k">Trade-off</p>
            <p className="hs-panel-tradeoff-v">{pin.tradeoff}</p>
          </div>
        )}
        <div className="hs-dots" role="tablist" aria-label="Decision pins">
          {pins.map((_, i) => (
            <button key={i} type="button" className="hs-dot" aria-pressed={i === active} aria-label={`Show pin ${i + 1}`} onClick={() => setActive(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
