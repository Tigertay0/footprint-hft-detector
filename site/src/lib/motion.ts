// Averlo Studio motion presets. Copy to lib/motion.ts.
// Hover is CSS (group-hover:), not Motion variants: a while*/initial prop on a reveal child
// makes it its own variant controller and it silently skips the parent's reveal.
import type { Transition, Variants } from "motion/react";

/** Snappy start, gentle deceleration (Linear / Apple feel). Mirror as --ease-premium in CSS. */
export const premiumEasing = [0.16, 1, 0.3, 1] as const;

export const revealTransition: Transition = { duration: 0.8, ease: premiumEasing };

/** Scroll reveal: initial="hidden" whileInView="visible" viewport={{ once: true }}. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: revealTransition },
};

/** Parent that staggers fadeUp children. Children get only `variants`, no other variant props. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

// CSS hover for bento cards (Tailwind v4, with --ease-premium in @theme):
// card:  "group transition-[border-color] duration-[400ms] ease-premium hover:border-white/20"
// photo: "transition-transform duration-[400ms] ease-premium group-hover:scale-105 motion-reduce:group-hover:scale-100"
