import { Suspense, useEffect, useState } from "react";
import { CLUSTERS, DEMOS, bySlug } from "./registry";
import "./_shared/tokens.css";
import "./shell.css";

const fromHash = () => {
  if (typeof window === "undefined") return DEMOS[0].slug;
  const h = window.location.hash.replace("#", "");
  return bySlug(h) ? h : DEMOS[0].slug;
};

export default function AiLabs() {
  const [slug, setSlug] = useState(fromHash);
  const [notes, setNotes] = useState(false);
  const demo = bySlug(slug)!;
  const idx = DEMOS.findIndex((d) => d.slug === slug);

  useEffect(() => {
    const on = () => setSlug(fromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const go = (s: string) => {
    window.history.replaceState(null, "", `#${s}`);
    setSlug(s);
    setNotes(false);
  };

  const Demo = demo.Demo;
  const prev = DEMOS[idx - 1];
  const next = DEMOS[idx + 1];

  return (
    <div className="labs al-shell">
      <nav className="al-rail" aria-label="Patterns">
        {CLUSTERS.map((c) => (
          <div key={c.id} className="al-cluster">
            <p className="al-cluster-h lab-mono">{c.label}</p>
            <ul>
              {DEMOS.filter((d) => d.cluster === c.id).map((d) => (
                <li key={d.slug}>
                  <button type="button" className="al-item" aria-current={d.slug === slug ? "page" : undefined} onClick={() => go(d.slug)}>
                    <span className="lab-mono al-n">{d.n}</span>
                    {d.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <section className="al-main" aria-live="polite">
        <p className="al-sim lab-mono">Simulated. No real agent is running, every state is scripted.</p>
        <h2 className="al-title">{demo.title}</h2>
        <p className="al-strap">{demo.strap}</p>

        <div className="al-stage" key={slug}>
          <Suspense fallback={<p className="lab-small lab-muted">Loading demo</p>}>
            <Demo />
          </Suspense>
        </div>

        <div className="al-notes">
          <button type="button" className="al-notes-btn" aria-expanded={notes} onClick={() => setNotes(!notes)}>
            <span className={"al-chev" + (notes ? " is-open" : "")} aria-hidden="true">›</span>
            Design notes
          </button>
          {notes && (
            <dl className="al-notes-body lab-in">
              <dt>Decision encoded</dt><dd>{demo.notes.decision}</dd>
              <dt>Trade-off</dt><dd>{demo.notes.tradeoff}</dd>
              <dt>Done well elsewhere</dt><dd>{demo.notes.doneWell}</dd>
            </dl>
          )}
        </div>
        <p className="al-insp lab-small lab-muted">Inspired by: {demo.inspired}</p>

        <div className="al-pager">
          {prev ? <button type="button" onClick={() => go(prev.slug)}>← {prev.title}</button> : <span />}
          {next ? <button type="button" onClick={() => go(next.slug)}>{next.title} →</button> : <span />}
        </div>
      </section>
    </div>
  );
}
