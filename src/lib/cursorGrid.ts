/**
 * A faint grid that lights up near the cursor — ported from the reference
 * the user pointed at (kokiltamta.in/assets/cursorGrid.js), not rebuilt from
 * scratch. The mechanics are unchanged: a per-cell alpha buffer, energised
 * within a falloff radius on pointer move, held, then faded; click pulses
 * ring outward and energise whatever cells they cross. Framework-agnostic,
 * self-contained, no dependencies, same structure as the source.
 *
 * What changed from the source, deliberately:
 *  - Colour isn't hardcoded. It's read from a CSS custom property at mount,
 *    so it's automatically the right ink colour for whichever theme is
 *    active rather than the reference's fixed magenta.
 *  - Grid lines stay off by default (gridOpacity: 0) — only the energised
 *    glow shows. Visible gridlines at rest read as a debug overlay on an
 *    enterprise portfolio; the glow alone reads as a considered detail.
 *  - Respects prefers-reduced-motion: the caller is expected to check it
 *    before calling init(), same convention as the rest of this site's
 *    motion (CountValue, the hero parallax, the scroll-reveal system).
 */

export interface CursorGridOptions {
  cellSize?: number;
  /** CSS color string, e.g. "#0d0d0c" or an rgb()/hsl() string. */
  color?: string;
  radius?: number;
  falloff?: "linear" | "smooth" | "sharp";
  holdTime?: number;
  fadeDuration?: number;
  lineWidth?: number;
  maxOpacity?: number;
  fillOpacity?: number;
  gridOpacity?: number;
  cellRadius?: number;
  clickPulse?: boolean;
  pulseSpeed?: number;
}

const FALLOFF_CURVES: Record<string, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  sharp: (t) => t * t * t,
};

function parseColor(input: string): [number, number, number] {
  if (input.startsWith("#")) {
    const h = input.slice(1);
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const num = parseInt(v.slice(0, 6), 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const m = input.match(/[\d.]+/g);
  if (m && m.length >= 3) return [Number(m[0]), Number(m[1]), Number(m[2])];
  return [13, 13, 12]; // falls back to the light-theme ink colour
}

export function initCursorGrid(container: HTMLElement, opts: CursorGridOptions = {}) {
  const p = {
    cellSize: 64,
    color: "#0d0d0c",
    radius: 150,
    falloff: "smooth" as const,
    holdTime: 300,
    fadeDuration: 700,
    lineWidth: 1,
    maxOpacity: 0.5,
    fillOpacity: 0,
    gridOpacity: 0,
    cellRadius: 2,
    clickPulse: false,
    pulseSpeed: 600,
    ...opts,
  };

  const canvas = document.createElement("canvas");
  canvas.className = "cursor-grid-canvas";
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  let cols = 0, rows = 0, offX = 0, offY = 0;
  let alphas = new Float32Array(0);
  let touched = new Float64Array(0);
  let w = 0, h = 0;
  const pulses: { x: number; y: number; t0: number }[] = [];
  let raf = 0;
  let running = false;
  let lastFrame = 0;

  function rebuild() {
    w = container.offsetWidth;
    h = container.offsetHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / p.cellSize) + 1;
    rows = Math.ceil(h / p.cellSize) + 1;
    offX = (w - cols * p.cellSize) / 2;
    offY = (h - rows * p.cellSize) / 2;
    alphas = new Float32Array(cols * rows);
    touched = new Float64Array(cols * rows);
  }

  function cellCenter(i: number): [number, number] {
    const cx = offX + (i % cols) * p.cellSize + p.cellSize / 2;
    const cy = offY + Math.floor(i / cols) * p.cellSize + p.cellSize / 2;
    return [cx, cy];
  }

  function energize(x: number, y: number, boost?: number) {
    const r = Math.max(p.radius, 1);
    const ease = FALLOFF_CURVES[p.falloff] || FALLOFF_CURVES.linear;
    const now = performance.now();
    const minCol = Math.max(0, Math.floor((x - r - offX) / p.cellSize));
    const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / p.cellSize));
    const minRow = Math.max(0, Math.floor((y - r - offY) / p.cellSize));
    const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / p.cellSize));
    for (let cRow = minRow; cRow <= maxRow; cRow++) {
      for (let cCol = minCol; cCol <= maxCol; cCol++) {
        const i = cRow * cols + cCol;
        const [cx, cy] = cellCenter(i);
        const dist = Math.hypot(cx - x, cy - y);
        if (dist > r) continue;
        const level = ease(1 - dist / r) * p.maxOpacity * (boost ?? 1);
        if (level > alphas[i]) {
          alphas[i] = level;
          touched[i] = now;
        } else if (level > 0) {
          touched[i] = now;
        }
      }
    }
  }

  function draw(now: number) {
    const dt = Math.min(now - lastFrame, 50);
    lastFrame = now;
    ctx!.clearRect(0, 0, w, h);
    const [cr, cg, cb] = parseColor(p.color);

    if (p.gridOpacity > 0) {
      ctx!.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${p.gridOpacity})`;
      ctx!.lineWidth = 1;
      ctx!.beginPath();
      for (let cCol = 0; cCol <= cols; cCol++) {
        const x = Math.round(offX + cCol * p.cellSize) + 0.5;
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, h);
      }
      for (let cRow = 0; cRow <= rows; cRow++) {
        const y = Math.round(offY + cRow * p.cellSize) + 0.5;
        ctx!.moveTo(0, y);
        ctx!.lineTo(w, y);
      }
      ctx!.stroke();
    }

    for (let pi = pulses.length - 1; pi >= 0; pi--) {
      const pulse = pulses[pi];
      const age = (now - pulse.t0) / 1000;
      const ringR = age * p.pulseSpeed;
      if (ringR > Math.hypot(w, h)) {
        pulses.splice(pi, 1);
        continue;
      }
      const band = p.cellSize;
      const minCol = Math.max(0, Math.floor((pulse.x - ringR - band - offX) / p.cellSize));
      const maxCol = Math.min(cols - 1, Math.floor((pulse.x + ringR + band - offX) / p.cellSize));
      const minRow = Math.max(0, Math.floor((pulse.y - ringR - band - offY) / p.cellSize));
      const maxRow = Math.min(rows - 1, Math.floor((pulse.y + ringR + band - offY) / p.cellSize));
      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const i = cRow * cols + cCol;
          const [cx, cy] = cellCenter(i);
          const dist = Math.hypot(cx - pulse.x, cy - pulse.y);
          if (Math.abs(dist - ringR) < band / 2 && p.maxOpacity > alphas[i]) {
            alphas[i] = p.maxOpacity;
            touched[i] = now;
          }
        }
      }
    }

    let anyVisible = pulses.length > 0;
    const fadeStep = dt / Math.max(p.fadeDuration, 16);
    const half = p.cellSize / 2;

    for (let i = 0; i < alphas.length; i++) {
      let a = alphas[i];
      if (a <= 0) continue;
      if (now - touched[i] > p.holdTime) {
        a = Math.max(0, a - fadeStep);
        alphas[i] = a;
        if (a <= 0) continue;
      }
      anyVisible = true;

      const [cx, cy] = cellCenter(i);
      const gradient = ctx!.createRadialGradient(cx, cy, half * 0.1, cx, cy, p.cellSize);
      gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`);
      gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);

      const x = cx - half + 0.5;
      const y = cy - half + 0.5;
      const s = p.cellSize - 1;

      ctx!.beginPath();
      if (p.cellRadius > 0) {
        ctx!.roundRect(x, y, s, s, p.cellRadius);
      } else {
        ctx!.rect(x, y, s, s);
      }
      if (p.fillOpacity > 0) {
        ctx!.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * p.fillOpacity})`;
        ctx!.fill();
      }
      ctx!.strokeStyle = gradient;
      ctx!.lineWidth = p.lineWidth;
      ctx!.stroke();
    }

    if (anyVisible) {
      raf = requestAnimationFrame(draw);
    } else {
      running = false;
      if (p.gridOpacity <= 0) ctx!.clearRect(0, 0, w, h);
    }
  }

  function wake() {
    if (running) return;
    running = true;
    lastFrame = performance.now();
    raf = requestAnimationFrame(draw);
  }

  function toLocal(e: PointerEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  // Only a mouse should light the grid (a touch drag would paint a trail while
  // the page scrolls), and nothing should run while the hero is off-screen.
  let visible = true;
  const vio = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
  });
  vio.observe(container);

  function onPointerMove(e: PointerEvent) {
    if (!visible || (e.pointerType && e.pointerType !== "mouse")) return;
    const [x, y] = toLocal(e);
    energize(x, y);
    wake();
  }

  function onPointerDown(e: PointerEvent) {
    if (!p.clickPulse || !visible) return;
    const [x, y] = toLocal(e);
    pulses.push({ x, y, t0: performance.now() });
    wake();
  }

  const ro = new ResizeObserver(() => {
    rebuild();
    wake();
  });
  ro.observe(container);
  rebuild();

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerdown", onPointerDown);

  return function destroy() {
    cancelAnimationFrame(raf);
    ro.disconnect();
    vio.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    canvas.remove();
  };
}
