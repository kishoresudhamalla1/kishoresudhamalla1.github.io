import { useState } from "react";
import "./work-interactive.css";

interface Props {
  prototypeUrl: string;
  screenshotSrc: string;
  screenshotAlt: string;
}

/**
 * Hero tab switcher: the live embedded prototype, or a static annotated
 * screenshot for anyone who'd rather scan than click. Two tabs, one visible
 * stage, no page navigation involved.
 */
export function ProtoTabs({ prototypeUrl, screenshotSrc, screenshotAlt }: Props) {
  const [tab, setTab] = useState<0 | 1>(0);

  return (
    <div className="pt">
      <div className="pt-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 0} className="pt-tab" onClick={() => setTab(0)}>
          Live interactive prototype
        </button>
        <button type="button" role="tab" aria-selected={tab === 1} className="pt-tab" onClick={() => setTab(1)}>
          Annotated system overview
        </button>
      </div>

      <div className="pt-stage">
        {tab === 0 ? (
          <>
            <div className="pt-bar">
              <span className="pt-bar-text">
                Try it: click <code>REQ-842</code> &rarr; click <code>[DPA §4.2]</code> &rarr; toggle remediation fixes
              </span>
              <a href={prototypeUrl} target="_blank" rel="noopener noreferrer" className="pt-open">
                Open fullscreen
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>
              </a>
            </div>
            <div className="pt-frame">
              <iframe src={prototypeUrl} title="Agent Control Plane live prototype" loading="lazy" />
            </div>
          </>
        ) : (
          <div className="pt-shot">
            <img src={screenshotSrc} alt={screenshotAlt} loading="lazy" />
          </div>
        )}
      </div>
    </div>
  );
}
