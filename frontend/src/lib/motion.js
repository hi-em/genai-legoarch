// Motion tokens — the single vocabulary every animated component speaks.
// Durations are in seconds (Framer Motion convention).
export const DUR = { fast: 0.1, base: 0.18, mod: 0.24, slow: 0.36 };

export const EASE = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
};

export const SPRING = {
  snap: { type: "spring", stiffness: 340, damping: 30, mass: 0.8 }, // gentle "settle"
  soft: { type: "spring", stiffness: 210, damping: 26 },
  bouncy: { type: "spring", stiffness: 360, damping: 22 }, // add-to-shelf pop
};

// Standard section/plate enter — fade + rise, with optional stagger of children.
export const enter = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DUR.mod, ease: EASE.standard },
  },
};

export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
};
