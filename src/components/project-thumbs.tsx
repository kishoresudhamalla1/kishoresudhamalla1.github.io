/* ─── Abstract SVG thumbnails — one per project ───────────────────────────
 * Shared by the project layouts so either can be removed independently.
 * Each fills its container; the parent supplies the accent background via
 * `color`, which the base <rect fill="currentColor"> picks up.
 */

export function WorkflowsThumb() {
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

export function TimeThumb() {
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

export function DesignOpsThumb() {
  return (
    <svg viewBox="0 0 320 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
      <rect width="320" height="200" fill="currentColor" />

      {/* topbar */}
      <rect x="16" y="14" width="288" height="20" rx="5" fill="white" fillOpacity="0.08" />
      <rect x="22" y="21" width="42" height="5" rx="2.5" fill="white" fillOpacity="0.45" />
      <rect x="252" y="21" width="46" height="6" rx="3" fill="white" fillOpacity="0.16" />

      {/* stat row */}
      {[16, 90, 164, 238].map((x, i) => (
        <g key={x}>
          <rect x={x} y="42" width="66" height="34" rx="5" fill="white" fillOpacity="0.07" />
          <rect x={x + 6} y="49" width={[20, 16, 22, 14][i]} height="10" rx="2" fill="white" fillOpacity={0.5 - i * 0.07} />
          <rect x={x + 6} y="64" width="40" height="4" rx="2" fill="white" fillOpacity="0.2" />
        </g>
      ))}

      {/* kanban columns */}
      {[16, 90, 164, 238].map((x, col) => (
        <g key={`c${x}`}>
          <rect x={x} y="86" width="66" height="6" rx="3" fill="white" fillOpacity="0.18" />
          {[0, 1, 2].slice(0, 3 - (col % 2)).map((r) => (
            <g key={r}>
              <rect x={x} y={98 + r * 30} width="66" height="24" rx="4" fill="white" fillOpacity={0.12 - r * 0.02} />
              <rect x={x + 5} y={104 + r * 30} width={44 - r * 8} height="4" rx="2" fill="white" fillOpacity="0.4" />
              <rect x={x + 5} y={112 + r * 30} width="26" height="3" rx="1.5" fill="white" fillOpacity="0.2" />
            </g>
          ))}
        </g>
      ))}

      {/* an overdue marker — the thing the tool exists to surface */}
      <rect x="164" y="98" width="66" height="24" rx="4" fill="#ef4444" fillOpacity="0.22" />
      <rect x="169" y="104" width="36" height="4" rx="2" fill="white" fillOpacity="0.6" />
      <circle cx="224" cy="106" r="3" fill="#ef4444" fillOpacity="0.9" />
      <rect x="169" y="112" width="22" height="3" rx="1.5" fill="white" fillOpacity="0.3" />
    </svg>
  );
}
