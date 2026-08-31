"use client";
import { motion, useScroll, useTransform } from "framer-motion";

/*
 * Two-layer parallax:
 *  - Outer motion.div: scroll-driven y-translation (Framer Motion)
 *  - Inner div:        organic position drift      (CSS keyframe animation)
 * Kept on separate elements so their transforms don't conflict.
 */
export function HeroParallax() {
  const { scrollY } = useScroll();

  const y1 = useTransform(scrollY, [0, 1000], [0, -70]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -140]);
  const y3 = useTransform(scrollY, [0, 1000], [0, -210]);

  const masterFade = useTransform(scrollY, [0, 560], [1, 0]);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* ── Top edge gradient line */}
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 5%, rgba(99,102,241,0.6) 30%, rgba(139,92,246,0.6) 70%, transparent 95%)",
          opacity: masterFade,
        }}
      />

      {/* ── Orb 1: top-right, deep layer */}
      <motion.div
        style={{
          y: y1,
          opacity: masterFade,
          position: "absolute",
          width: 1000,
          height: 1000,
          right: -340,
          top: -380,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 38% 38%, rgba(99,102,241,0.38) 0%, rgba(139,92,246,0.18) 38%, transparent 62%)",
            filter: "blur(55px)",
            animation: "orb-drift-1 24s ease-in-out infinite",
          }}
        />
      </motion.div>

      {/* ── Orb 2: bottom-left, mid layer */}
      <motion.div
        style={{
          y: y2,
          opacity: masterFade,
          position: "absolute",
          width: 820,
          height: 820,
          left: -240,
          bottom: -200,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 60% 60%, rgba(139,92,246,0.28) 0%, rgba(99,102,241,0.12) 45%, transparent 68%)",
            filter: "blur(70px)",
            animation: "orb-drift-2 30s ease-in-out infinite",
            animationDelay: "-8s",
          }}
        />
      </motion.div>

      {/* ── Orb 3: center-left, closest layer, fastest parallax */}
      <motion.div
        style={{
          y: y3,
          opacity: useTransform(scrollY, [0, 340], [0.7, 0]),
          position: "absolute",
          width: 500,
          height: 500,
          left: "20%",
          top: "5%",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 50% 50%, rgba(16,185,129,0.16) 0%, rgba(99,102,241,0.08) 45%, transparent 68%)",
            filter: "blur(60px)",
            animation: "orb-drift-3 18s ease-in-out infinite",
            animationDelay: "-5s",
          }}
        />
      </motion.div>

      {/* ── Subtle dot grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, var(--color-ink) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          opacity: 0.02,
        }}
      />
    </div>
  );
}
