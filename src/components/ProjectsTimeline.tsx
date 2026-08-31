import { useEffect, useRef, useState } from "react";
import { WorkflowsThumb, TimeThumb, DesignOpsThumb } from "./project-thumbs";

/**
 * Scroll-driven horizontal project timeline.
 *
 * Cards sit on a snap rail; their distance from the rail's centre drives a
 * perspective falloff (translateZ + rotateY + scale + fade), so the centred
 * project reads as "active" and neighbours recede. A tick ruler underneath
 * carries a playhead synced to scroll position, plus the active project's year.
 *
 * Transforms are written straight to the DOM inside a rAF so scrolling never
 * triggers a React re-render; only the active-index change does.
 */

interface Project {
  href: string;
  index: string;
  year: string;
  title: string;
  problem: string;
  outcomeStat: string;
  outcomeLabel: string;
  tags: string[];
  accent: string;
  accentInk: string;
  visual: React.ReactNode;
}

const projects: Project[] = [
  {
    href: "/work/time-management-system",
    index: "01",
    year: "2023",
    title: "Time Management, rebuilt for scale",
    problem:
      "An eight-year-old product had grown harder to use with every new customer and market.",
    outcomeStat: "73.1%",
    outcomeLabel: "engagement on launch",
    tags: ["Enterprise UX", "Global HR Tech", "Mobile"],
    accent: "#c8a96e",
    accentInk: "#7a5c1e",
    visual: <TimeThumb />,
  },
  {
    href: "/work/workflows-journeys",
    index: "02",
    year: "2024",
    title: "Designing Journeys for complex teams",
    problem:
      "Onboarding, transfers, and role changes rarely happen in one workflow, they move across systems.",
    outcomeStat: "120+",
    outcomeLabel: "countries deployed",
    tags: ["Platform design", "Workflows", "Enterprise UX"],
    accent: "#8b87d8",
    accentInk: "#4b47a8",
    visual: <WorkflowsThumb />,
  },
  {
    href: "/work/design-ops",
    index: "03",
    year: "2026",
    title: "From design operations to design intelligence",
    problem:
      "Design work was visible; design health wasn't. I designed and built the system that reads the work instead of reporting it.",
    outcome: "Shipped and in daily use, then extended with an evidence-cited intelligence layer.",
    outcomeStat: "0 → 1",
    outcomeLabel: "designed, built, shipped solo",
    tags: ["Enterprise DesignOps", "AI-native", "Hands-on build"],
    accent: "#5aaa7c",
    accentInk: "#2a7a52",
    visual: <DesignOpsThumb />,
  },
];

const TICKS = 48;

export function ProjectsTimeline() {
  const railRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let lastActive = -1;

    const update = () => {
      raf = 0;
      const railRect = rail.getBoundingClientRect();
      const centre = railRect.left + railRect.width / 2;
      const half = railRect.width / 2 || 1;

      const cards = rail.querySelectorAll<HTMLElement>("[data-card]");
      let nearest = 0;
      let nearestDist = Infinity;

      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const delta = r.left + r.width / 2 - centre;
        const norm = Math.max(-1, Math.min(1, delta / half));
        const t = Math.abs(norm);

        if (t < nearestDist) {
          nearestDist = t;
          nearest = i;
        }

        if (!reduce) {
          card.style.transform =
            `translateZ(${(-120 * t).toFixed(1)}px) ` +
            `rotateY(${(-10 * norm).toFixed(2)}deg) ` +
            `scale(${(1 - 0.07 * t).toFixed(3)})`;
          card.style.opacity = (1 - 0.55 * t).toFixed(3);
        }
      });

      const max = rail.scrollWidth - rail.clientWidth;
      const p = max > 4 ? rail.scrollLeft / max : 0;
      if (playheadRef.current) {
        playheadRef.current.style.left = `${(p * 100).toFixed(2)}%`;
      }

      if (nearest !== lastActive) {
        lastActive = nearest;
        setActive(nearest);
      }
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    rail.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();

    return () => {
      rail.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const step = (dir: -1 | 1) => {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>("[data-card]");
    const w = card ? card.offsetWidth + 28 : rail.clientWidth * 0.8;
    rail.scrollBy({ left: dir * w, behavior: "smooth" });
  };

  return (
    <section id="cases" className="pt-16 pb-24 md:pt-20">
      {/* ── Header ── */}
      <div className="container-pg">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-label mb-4 text-[var(--color-ink-3)]">Selected work</p>
            <h2 className="text-display-sm max-w-2xl">
              Three projects. Complex systems made clearer.
            </h2>
          </div>

          <div className="flex items-center gap-2.5">
            {([-1, 1] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => step(dir)}
                aria-label={dir === -1 ? "Previous project" : "Next project"}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-ink-2)] transition-colors hover:border-[var(--color-ink)] hover:bg-[var(--color-ink)] hover:text-[var(--color-bg)]"
              >
                {dir === -1 ? "←" : "→"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scroll rail ── */}
      <div
        ref={railRef}
        className="pt-rail"
        role="region"
        aria-label="Project timeline, scroll horizontally"
        tabIndex={0}
      >
        {projects.map((p, i) => (
          <a
            key={p.href}
            href={p.href}
            data-card
            className="pt-card group"
            aria-current={i === active ? "true" : undefined}
          >
            {/* Visual */}
            <div
              className="pt-visual"
              style={{ backgroundColor: p.accent, color: p.accent }}
            >
              {p.visual}
            </div>

            {/* Body */}
            <div className="pt-body">
              <div className="mb-4 flex items-center gap-3.5">
                <span className="text-label tabular-nums text-[var(--color-ink-3)]">
                  {p.index}
                </span>
                <span className="h-px w-7 bg-[var(--color-border)]" />
                <span className="text-label text-[var(--color-ink-3)]">{p.year}</span>
              </div>

              <h3 className="text-xl font-bold leading-tight tracking-tight text-[var(--color-ink)] md:text-2xl">
                {p.title}
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-[var(--color-ink-2)]">
                {p.problem}
              </p>

              <div className="mt-5 flex items-baseline gap-2">
                <span
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: p.accentInk }}
                >
                  {p.outcomeStat}
                </span>
                <span className="text-xs text-[var(--color-ink-3)]">
                  {p.outcomeLabel}
                </span>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
                {p.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[11px] font-medium text-[var(--color-ink-3)]"
                  >
                    {tag}
                  </span>
                ))}
                <span className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-sm text-[var(--color-ink-2)] transition-all duration-300 group-hover:-rotate-45 group-hover:border-[var(--color-ink)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]">
                  →
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>

      {/* ── Ruler ── */}
      <div className="container-pg">
        <div className="pt-ruler" aria-hidden="true">
          <div className="pt-ticks">
            {Array.from({ length: TICKS }).map((_, i) => (
              <span key={i} className={i % 6 === 0 ? "pt-tick pt-tick--major" : "pt-tick"} />
            ))}
          </div>
          <div ref={playheadRef} className="pt-playhead" />
        </div>

        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-label text-[var(--color-ink)] tabular-nums">
            {projects[active].year}
          </span>
          <span className="text-label text-[var(--color-ink-3)] tabular-nums">
            {projects[active].index} / {String(projects.length).padStart(2, "0")}
          </span>
        </div>
      </div>

    </section>
  );
}
