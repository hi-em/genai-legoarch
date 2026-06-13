import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        elevated: "var(--elevated)",
        sunken: "var(--sunken)",
        table: "var(--table)",
        "table-deep": "var(--table-deep)",
        "table-line": "var(--table-line)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        muted: "var(--muted)",
        "muted-faint": "var(--muted-faint)",
        "on-dark": "var(--on-dark)",
        "on-dark-muted": "var(--on-dark-muted)",
        border: "var(--border)",
        "border-strong": "var(--border-strong)",
        "border-dark": "var(--border-dark)",
        "plate-edge": "var(--plate-edge)",
        stone: {
          50: "#f4f5f2",
          100: "#e7e9e4",
          200: "#cfd2cb",
          300: "#c4c8cb",
          400: "#a0a5a9",
          500: "#6c6e68",
          600: "#565a56",
          700: "#4b4f4c",
          800: "#3a3d3a",
          900: "#20262b",
        },
        brand: {
          red: "var(--brand-red)",
          "red-dark": "var(--brand-red-dark)",
          yellow: "var(--brand-yellow)",
          "yellow-dark": "var(--brand-yellow-dark)",
          blue: "var(--brand-blue)",
          "blue-dark": "var(--brand-blue-dark)",
          tan: "var(--brand-tan)",
        },
        ok: { bg: "#e6f3ea", fg: "#1f6f37" },
        warn: { bg: "#fbeaea", fg: "#9e1408" },
      },
      spacing: {
        "stud-half": "4px",
        stud: "8px",
        "stud-2": "16px",
        "stud-3": "24px",
        "stud-4": "32px",
        "stud-6": "48px",
      },
      maxWidth: {
        plate: "920px",
        "plate-wide": "1120px",
        stage: "1240px", // waiting-room stage width
      },
      borderRadius: {
        DEFAULT: "6px",
        sm: "4px",
        lg: "12px",
        xl: "16px",
        stud: "50% 50% 2px 2px",
        pill: "999px",
      },
      boxShadow: {
        plate: "var(--shadow-plate)",
        "plate-flat": "var(--shadow-plate-flat)",
        brick: "var(--shadow-brick)",
        "brick-press": "var(--shadow-brick-press)",
        pop: "var(--shadow-pop)",
        focus: "0 0 0 3px color-mix(in srgb, var(--brand-blue) 35%, transparent)",
      },
      fontFamily: {
        display: ['"Nunito"', "system-ui", "sans-serif"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        micro: ["0.6875rem", { lineHeight: "1.45" }],
        nano: ["0.625rem", { lineHeight: "1.4", letterSpacing: "0.02em" }],
        caption: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        sm: ["0.8125rem", { lineHeight: "1.45" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        lead: ["1.0625rem", { lineHeight: "1.6" }],
        h3: ["1.0625rem", { lineHeight: "1.3", letterSpacing: "-0.01em" }],
        h2: ["1.5rem", { lineHeight: "1.2", letterSpacing: "-0.015em" }],
        h1: ["2rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        display: ["2.75rem", { lineHeight: "1.05", letterSpacing: "-0.025em" }],
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0, 1)",
        emphasized: "cubic-bezier(0.3, 0, 0, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
        snap: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
      transitionDuration: {
        fast: "100ms",
        DEFAULT: "180ms",
        moderate: "240ms",
        slow: "360ms",
        flip: "500ms", // CSS-3D card flip — paired with DUR.flip in lib/motion.js
      },
      keyframes: {
        studpop: {
          "0%,100%": { transform: "translateY(0)", opacity: ".5" },
          "50%": { transform: "translateY(-5px)", opacity: "1" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        bob: {
          "0%,100%": { transform: "translateY(0) rotate(-2deg)" },
          "50%": { transform: "translateY(-5px) rotate(2deg)" },
        },
        // waiting-room square treatments (see hero/StageSquare.jsx)
        kenburns: {
          "0%": { transform: "scale(1)" },
          "100%": { transform: "scale(1.06)" },
        },
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        studpop: "studpop .9s infinite ease-in-out",
        shimmer: "shimmer 1.4s infinite",
        bob: "bob 3.5s ease-in-out infinite",
        kenburns: "kenburns 18s ease-in-out infinite alternate",
        sweep: "sweep 2.8s linear infinite",
      },
    },
  },
  plugins: [animate],
};
