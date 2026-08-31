import { useEffect, useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";

/**
 * Metric counter for the hero.
 *
 * Deliberately NOT driven by the global [data-count] script. That script
 * rewrites text inside this island before hydration, which React sees as a
 * server/client mismatch and answers by discarding the whole island. Rendering
 * the final value on both sides and animating through a ref keeps the markup
 * identical, so hydration stays clean.
 */
function CountValue({ value, index }: { value: string; index: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const m = value.match(/-?[\d][\d,]*(\.\d+)?/);
    if (!m || m.index === undefined) return;
    const target = parseFloat(m[0].replace(/,/g, ""));
    const dot = m[0].indexOf(".");
    const decimals = dot === -1 ? 0 : m[0].length - dot - 1;
    const prefix = value.slice(0, m.index);
    const suffix = value.slice(m.index + m[0].length);

    let raf = 0;
    const DURATION = 1400;
    const start = performance.now() + index * 90;

    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION));
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
      if (t < 1) raf = requestAnimationFrame(tick);
      else el.textContent = value;
    };

    el.textContent = prefix + (0).toFixed(decimals) + suffix;
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, index]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
  );
}

export function HeroSection() {
  const { scrollY } = useScroll();
  // Scroll parallax lives on the wrapper, never on the image: the image runs a
  // CSS float animation, and an inline transform from Framer Motion would
  // silently win over it. Two elements, one transform each.
  const photoY = useTransform(scrollY, [0, 700], [0, -56]);

  return (
    <section className="container-pg relative pt-4 pb-16 md:min-h-[calc(100svh-3.5rem)] md:flex md:items-start md:pt-14 md:pb-12">
      <div className="w-full flex flex-col items-start gap-10 md:flex-row md:items-center md:gap-12 lg:gap-20">

        {/* ── Text column ───────────────────────────────── */}
        <div className="min-w-0 flex-1 md:max-w-xl">

          {/* Positioning first: what I do now, before who I am. */}
          <p
            className="hero-item mb-6 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-[var(--color-ink-3)]"
            style={{ animationDelay: "40ms" }}
          >
            UX &amp; Product Design Leader · AI-Native &amp; Agentic Experiences
          </p>

          <h1
            className="hero-head mb-6 hero-item"
            style={{ animationDelay: "80ms" }}
          >
            I design AI that knows when to{" "}
            <span className="text-[var(--color-ink-2)]">act, assist, and step back.</span>
          </h1>

          <p
            className="mb-9 max-w-lg text-base leading-relaxed text-[var(--color-ink-2)] hero-item"
            style={{ animationDelay: "160ms" }}
          >
            I design AI-native experiences for complex enterprise products, where agents
            work across real workflows, systems and decisions. With 16+ years in design and
            nearly 9 years in enterprise HR technology, I bring deep systems thinking to the
            shift from software people use to software that can act.
          </p>

          <div
            className="flex flex-wrap items-center gap-5 hero-item"
            style={{ animationDelay: "240ms" }}
          >
            <a
              href="#cases"
              aria-label="See the work"
              className="roll-btn inline-flex items-center rounded-full bg-[var(--color-ink)] px-7 py-3.5 text-sm font-medium text-[var(--color-bg)] no-underline"
            >
              <span className="roll" aria-hidden="true">
                <span className="roll-copy">See the work ↓</span>
                <span className="roll-copy roll-copy--in">See the work ↓</span>
              </span>
            </a>
            <a
              href="mailto:build@kishoresudhamalla.com"
              aria-label="Start a conversation"
              className="roll-btn text-sm font-medium text-[var(--color-ink-2)] no-underline transition-colors hover:text-[var(--color-ink)]"
            >
              <span className="roll" aria-hidden="true">
                <span className="roll-copy">Start a conversation →</span>
                <span className="roll-copy roll-copy--in">Start a conversation →</span>
              </span>
            </a>
          </div>

          {/* Proof, not a card: four facts on a hairline rule. */}
          <dl className="hero-proof hero-item" style={{ animationDelay: "240ms" }}>
            {[
              { value: "16+", label: "Years design" },
              { value: "~9", label: "Years enterprise HR" },
              { value: "6", label: "Current design scope" },
              { value: "120+", label: "Countries, Journeys reach" },
            ].map(({ value, label }, i) => (
              <div key={label}>
                <dt>
                  <CountValue value={value} index={i} />
                </dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* ── Photo column ──────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ y: photoY }}
          className="hero-photo"
        >
          {/*
            No frame and no clipping wrapper: the plate carries its own studio
            background, so the photograph is the object. It floats on a slow
            loop and drifts with the scroll, which is what gives it depth
            against the flat page.
          */}
          <picture>
            <source srcSet="/images/kishore-portrait.webp" type="image/webp" />
            <img
              src="/images/kishore-portrait.jpg"
              alt="Kishore Kumar Sudhamalla"
              width={780}
              height={907}
              className="hero-portrait"
            />
          </picture>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 1.2 }}
        className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
      >
        <span className="text-label text-[var(--color-ink-3)]">scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 1,
            height: 28,
            background: "var(--color-ink-3)",
            borderRadius: 1,
          }}
        />
      </motion.div>
    </section>
  );
}
