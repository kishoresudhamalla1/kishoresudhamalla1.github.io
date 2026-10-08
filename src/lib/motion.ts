/**
 * JS mirror of the motion tokens in src/styles/global.css (:root --dur-*,
 * --ease-*, --dist-*). Keep the two in step; CSS is the source of truth and
 * these exist only for the few pieces of motion that run from script.
 */
export const motion = {
  duration: { micro: 140, fast: 200, normal: 280, slow: 420, narrative: 600 },
  ease: {
    enter: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.7, 0, 0.84, 0)",
    move: "cubic-bezier(0.65, 0, 0.35, 1)",
    emphasized: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  distance: { small: 4, medium: 12 },
} as const;

export const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Run `onChange(visible)` whenever `el` enters or leaves the viewport. Used to
 * pause ambient loops (video, pulses, canvas) while they are off-screen.
 */
export function watchVisibility(
  el: Element,
  onChange: (visible: boolean) => void,
  margin = "80px"
) {
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => onChange(e.isIntersecting)),
    { rootMargin: margin }
  );
  io.observe(el);
  return () => io.disconnect();
}
