import { useRef } from "react";
import { motion } from "framer-motion";

interface CaseStudy {
  href: string;
  title: string;
  problem: string;
  outcome: string;
  outcomeStat: string;
  outcomeLabel: string;
  tags: string[];
  year: string;
  index: string;
  visual: React.ReactNode;
}

const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── Abstract SVG thumbnails — one per project ─────────────────────────── */

function WorkflowsThumb() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      {/* Background */}
      <rect width="320" height="200" fill="currentColor" />
      {/* Flow nodes row 1 */}
      <rect x="20" y="30" width="60" height="36" rx="8" fill="white" fillOpacity="0.12" />
      <rect x="22" y="38" width="36" height="5" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="22" y="46" width="24" height="4" rx="2" fill="white" fillOpacity="0.25" />
      {/* Arrow */}
      <line x1="83" y1="48" x2="106" y2="48" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      <polygon points="106,44 114,48 106,52" fill="white" fillOpacity="0.3" />
      {/* Node 2 */}
      <rect x="116" y="30" width="60" height="36" rx="8" fill="white" fillOpacity="0.18" />
      <rect x="118" y="38" width="36" height="5" rx="2" fill="white" fillOpacity="0.7" />
      <rect x="118" y="46" width="24" height="4" rx="2" fill="white" fillOpacity="0.35" />
      {/* Arrow */}
      <line x1="179" y1="48" x2="202" y2="48" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
      <polygon points="202,44 210,48 202,52" fill="white" fillOpacity="0.3" />
      {/* Node 3 */}
      <rect x="212" y="30" width="90" height="36" rx="8" fill="white" fillOpacity="0.1" />
      <rect x="214" y="38" width="54" height="5" rx="2" fill="white" fillOpacity="0.4" />
      <rect x="214" y="46" width="36" height="4" rx="2" fill="white" fillOpacity="0.2" />

      {/* Branch — curved connector */}
      <path d="M176 66 Q176 90 120 90" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />

      {/* Row 2 */}
      <rect x="20" y="100" width="80" height="36" rx="8" fill="white" fillOpacity="0.08" />
      <rect x="22" y="108" width="48" height="5" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="22" y="116" width="32" height="4" rx="2" fill="white" fillOpacity="0.15" />

      <line x1="103" y1="118" x2="120" y2="118" stroke="white" strokeOpacity="0.2" strokeWidth="1.5" />

      <rect x="122" y="100" width="80" height="36" rx="8" fill="white" fillOpacity="0.14" />
      <rect x="124" y="108" width="48" height="5" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="124" y="116" width="32" height="4" rx="2" fill="white" fillOpacity="0.25" />

      {/* Status row */}
      <rect x="20" y="155" width="16" height="16" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="42" y="158" width="60" height="4" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="20" y="177" width="16" height="16" rx="4" fill="white" fillOpacity="0.1" />
      <rect x="42" y="180" width="40" height="4" rx="2" fill="white" fillOpacity="0.15" />

      {/* Connector line on right */}
      <rect x="262" y="100" width="40" height="60" rx="8" fill="white" fillOpacity="0.07" />
      <rect x="266" y="108" width="24" height="4" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="266" y="116" width="18" height="4" rx="2" fill="white" fillOpacity="0.15" />
      <rect x="266" y="124" width="20" height="4" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="266" y="132" width="14" height="4" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="266" y="140" width="22" height="4" rx="2" fill="white" fillOpacity="0.1" />
    </svg>
  );
}


function TimeThumb() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect width="320" height="200" fill="currentColor" />

      {/* Dashboard header */}
      <rect x="16" y="16" width="288" height="32" rx="6" fill="white" fillOpacity="0.08" />
      <rect x="24" y="24" width="60" height="5" rx="2" fill="white" fillOpacity="0.4" />
      <rect x="24" y="32" width="40" height="4" rx="2" fill="white" fillOpacity="0.2" />
      {/* Status chips in header */}
      <rect x="200" y="22" width="36" height="16" rx="8" fill="white" fillOpacity="0.15" />
      <rect x="202" y="27" width="20" height="5" rx="2" fill="white" fillOpacity="0.5" />
      <rect x="242" y="22" width="52" height="16" rx="8" fill="white" fillOpacity="0.1" />
      <rect x="244" y="27" width="32" height="5" rx="2" fill="white" fillOpacity="0.3" />

      {/* Left column: team list */}
      <rect x="16" y="56" width="140" height="130" rx="6" fill="white" fillOpacity="0.06" />
      <rect x="24" y="64" width="50" height="4" rx="2" fill="white" fillOpacity="0.3" />

      {/* Team member rows */}
      {[80, 100, 120, 140, 160].map((y, i) => (
        <g key={y}>
          <circle cx="30" cy={y + 8} r="8" fill="white" fillOpacity={0.1 + i * 0.02} />
          <rect x="44" y={y + 4} width={i === 2 ? 40 : 56} height="4" rx="2" fill="white" fillOpacity="0.3" />
          <rect x="44" y={y + 11} width="28" height="3" rx="1.5" fill="white" fillOpacity="0.15" />
          {/* Status dot */}
          <circle cx={140} cy={y + 8} r="5" fill="white" fillOpacity={i === 1 ? 0.6 : i === 3 ? 0.3 : 0.15} />
        </g>
      ))}

      {/* Right column: insights panel */}
      <rect x="164" y="56" width="140" height="60" rx="6" fill="white" fillOpacity="0.1" />
      <rect x="172" y="64" width="48" height="4" rx="2" fill="white" fillOpacity="0.35" />
      <rect x="172" y="72" width="112" height="3" rx="1.5" fill="white" fillOpacity="0.2" />
      <rect x="172" y="79" width="88" height="3" rx="1.5" fill="white" fillOpacity="0.15" />
      <rect x="172" y="90" width="36" height="14" rx="4" fill="white" fillOpacity="0.2" />
      <rect x="176" y="94" width="22" height="4" rx="2" fill="white" fillOpacity="0.5" />

      {/* Right column: metrics */}
      <rect x="164" y="124" width="66" height="62" rx="6" fill="white" fillOpacity="0.08" />
      <rect x="172" y="132" width="28" height="14" rx="2" fill="white" fillOpacity="0.4" />
      <rect x="172" y="150" width="44" height="4" rx="2" fill="white" fillOpacity="0.25" />
      <rect x="172" y="157" width="36" height="3" rx="1.5" fill="white" fillOpacity="0.15" />
      <rect x="172" y="164" width="40" height="3" rx="1.5" fill="white" fillOpacity="0.1" />

      <rect x="238" y="124" width="66" height="62" rx="6" fill="white" fillOpacity="0.06" />
      <rect x="246" y="132" width="28" height="14" rx="2" fill="white" fillOpacity="0.3" />
      <rect x="246" y="150" width="44" height="4" rx="2" fill="white" fillOpacity="0.2" />
      <rect x="246" y="157" width="36" height="3" rx="1.5" fill="white" fillOpacity="0.12" />
      <rect x="246" y="164" width="40" height="3" rx="1.5" fill="white" fillOpacity="0.08" />
    </svg>
  );
}

const studies: CaseStudy[] = [
  {
    href: "/work/time-management-system",
    index: "01",
    title: "Time Management, rebuilt for scale",
    problem:
      "An eight-year-old product had grown harder to use with every new customer and market.",
    outcome: "Gartner WFM rating rose from 2.9 to 3.5. 73.1% manager engagement on launch.",
    outcomeStat: "73.1%",
    outcomeLabel: "engagement on launch",
    tags: ["Enterprise UX", "Global HR Tech", "Mobile"],
    year: "2023",
    visual: <TimeThumb />,
  },
  {
    href: "/work/workflows-journeys",
    index: "02",
    title: "Designing Journeys for complex teams",
    problem:
      "Onboarding, transfers, and role changes rarely happen in one workflow. They move across systems.",
    outcome: "A flexible framework organisations could adapt to how they work.",
    outcomeStat: "120+",
    outcomeLabel: "countries deployed",
    tags: ["Platform design", "Workflows", "Enterprise UX"],
    year: "2024",
    visual: <WorkflowsThumb />,
  },
];

/* accent colours per project — light / dark */
const accents = [
  { bg: "#c8a96e", bgDark: "#2e2310", text: "#7a5c1e" },
  { bg: "#8b87d8", bgDark: "#1e1c42", text: "#4b47a8" },
  { bg: "#5aaa7c", bgDark: "#112d1e", text: "#2a7a52" },
];

function ProjectRow({ study, i }: { study: CaseStudy; i: number }) {
  const ref = useRef<HTMLAnchorElement>(null);

  return (
    <motion.a
      ref={ref}
      href={study.href}
      className="group relative block overflow-hidden rounded-3xl border border-[var(--color-border)] no-underline transition-colors duration-200 hover:border-[var(--color-ink-3)]"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay: 0.16 + i * 0.09, ease: EASE }}
    >
      <div className="grid md:grid-cols-2">
        {/* ── Visual ── */}
        <div
          className="relative order-1 flex aspect-[4/3] flex-col justify-end overflow-hidden transition-opacity duration-300 group-hover:opacity-90 md:aspect-auto md:order-2"
          style={{ backgroundColor: accents[i].bg, color: accents[i].bg }}
        >
          <div className="absolute inset-0">{study.visual}</div>
          <div className="relative bg-black/25 px-6 py-4 backdrop-blur-sm">
            <p className="text-xs leading-snug text-white/85">{study.outcome}</p>
          </div>
        </div>

        {/* ── Text content ── */}
        <div className="order-2 flex flex-col p-8 md:order-1 md:p-10">
          {/* Index + year */}
          <div className="mb-5 flex items-center gap-4">
            <span className="text-label text-[var(--color-ink-3)] tabular-nums">
              {study.index}
            </span>
            <span className="h-px w-8 bg-[var(--color-border)]" />
            <span className="text-label text-[var(--color-ink-3)]">{study.year}</span>
          </div>

          {/* Title */}
          <h3 className="text-2xl font-bold leading-tight tracking-tight text-[var(--color-ink)] md:text-3xl">
            {study.title}
          </h3>

          {/* Problem */}
          <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-2)] md:text-base">
            {study.problem}
          </p>

          {/* Outcome stat — the hook */}
          <div className="mt-6 flex items-baseline gap-2">
            <span
              className="text-3xl font-bold tracking-tight"
              style={{ color: accents[i].text }}
            >
              {study.outcomeStat}
            </span>
            <span className="text-xs text-[var(--color-ink-3)]">{study.outcomeLabel}</span>
          </div>

          {/* Tags + arrow */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            {study.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-[11px] font-medium text-[var(--color-ink-3)] transition-colors duration-200 group-hover:border-[var(--color-ink-3)] group-hover:text-[var(--color-ink-2)]"
              >
                {tag}
              </span>
            ))}
            <div className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-base text-[var(--color-ink-2)] transition-all duration-300 group-hover:-rotate-45 group-hover:border-[var(--color-ink)] group-hover:bg-[var(--color-ink)] group-hover:text-[var(--color-bg)]">
              →
            </div>
          </div>
        </div>
      </div>
    </motion.a>
  );
}

export function CaseStudyCards() {
  return (
    <section id="cases" className="container-pg pb-24 pt-16 md:pt-20">
      <motion.div
        className="mb-16"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: EASE }}
      >
        <p className="text-label mb-4 text-[var(--color-ink-3)]">Selected work</p>
        <h2 className="text-display-sm max-w-2xl">
          Two projects. Complex systems made clearer.
        </h2>
      </motion.div>

      <div className="flex flex-col gap-6">
        {studies.map((study, i) => (
          <ProjectRow key={study.href} study={study} i={i} />
        ))}
      </div>
    </section>
  );
}
