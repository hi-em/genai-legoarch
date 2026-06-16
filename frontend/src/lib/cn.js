import { clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our Tailwind theme renames the whole fontSize scale (micro/nano/caption/body/
// lead/h1–h3/display — see tailwind.config.js). tailwind-merge doesn't know these
// are FONT SIZES, so it misfiles e.g. `text-micro` into the text-COLOR group and
// then drops a real `text-brand-blue` that sits next to it (last-wins). Register
// them as font sizes so size + color utilities coexist instead of clobbering.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["micro", "nano", "caption", "body", "lead", "h1", "h2", "h3", "display"] },
      ],
    },
  },
});

// Merge conditional class lists and dedupe conflicting Tailwind utilities.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
