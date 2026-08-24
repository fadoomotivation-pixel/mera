import type { Config } from "tailwindcss";

/** MERA MAKAN design system.
 *
 * Palette discipline is deliberate and narrow: navy grounds everything, ivory
 * carries content, and gold appears ONLY on money, milestones and selected
 * state. Success/warning/danger are muted so that a page full of healthy rows
 * never reads as decorative — colour is reserved for meaning. See
 * docs/08-design-system.md. */
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Ground. 900 is the canvas; 800/700 are raised surfaces.
        navy: {
          900: "#0B1D33",
          800: "#12263F",
          700: "#162F52",
          600: "#1D3A63",
          500: "#27497A",
          400: "#3D6099",
          300: "#6C8CBC",
          200: "#A8BDD8",
          100: "#D3DEEC",
        },
        // Gold. Reserved: money, milestones, selected state, premium accent.
        gold: {
          700: "#8C7018",
          600: "#A8871D",
          500: "#C9A227",
          400: "#D9B856",
          300: "#E5CE8A",
          200: "#F0E3BD",
          100: "#F7F1DE",
        },
        ivory: {
          DEFAULT: "#F5F2EC",
          50: "#FBFAF7",
          100: "#F5F2EC",
          200: "#E9E4D9",
          300: "#D8D1C2",
        },
        // Exactly one of each. Muted on purpose — never neon.
        success: { DEFAULT: "#2F7D5B", soft: "#E4F0EA", strong: "#215B42" },
        warning: { DEFAULT: "#9A6B1E", soft: "#F6EDDD", strong: "#7A5417" },
        danger: { DEFAULT: "#A33A32", soft: "#F6E5E3", strong: "#7F2C26" },
      },
      fontFamily: {
        // Display — headlines only, never body.
        display: ["var(--font-display)", "Georgia", "serif"],
        // UI — everything else.
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        // Devanagari — the tagline and Hindi copy deserve a real face.
        deva: ["var(--font-deva)", "var(--font-sans)", "sans-serif"],
        // Tabular figures for money so columns align and digits don't jitter.
        mono: ["var(--font-sans)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // A deliberate hierarchy. Money uses the display sizes.
        "display-xl": ["clamp(2.75rem, 7vw, 5rem)", { lineHeight: "1.02", letterSpacing: "-0.03em", fontWeight: "700" }],
        "display-lg": ["clamp(2.25rem, 5.5vw, 3.75rem)", { lineHeight: "1.06", letterSpacing: "-0.025em", fontWeight: "700" }],
        "display-md": ["clamp(1.75rem, 4vw, 2.5rem)", { lineHeight: "1.12", letterSpacing: "-0.02em", fontWeight: "700" }],
        "money-xl": ["clamp(2rem, 5vw, 3rem)", { lineHeight: "1.05", letterSpacing: "-0.02em", fontWeight: "600" }],
        "money-lg": ["clamp(1.5rem, 3.5vw, 2rem)", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "600" }],
        "money-md": ["1.25rem", { lineHeight: "1.2", letterSpacing: "-0.01em", fontWeight: "600" }],
        eyebrow: ["0.6875rem", { lineHeight: "1.2", letterSpacing: "0.14em", fontWeight: "600" }],
        caption: ["0.8125rem", { lineHeight: "1.45" }],
      },
      spacing: {
        // Generous by default — whitespace is part of the design.
        section: "clamp(4rem, 9vw, 8rem)",
        gutter: "clamp(1.25rem, 5vw, 2.5rem)",
      },
      borderRadius: {
        card: "1rem",
        sheet: "1.5rem",
        pill: "999px",
      },
      boxShadow: {
        // Soft and quiet. Cards should feel like paper, not like they float.
        card: "0 1px 2px rgba(11,29,51,0.04), 0 8px 24px -12px rgba(11,29,51,0.10)",
        raised: "0 2px 4px rgba(11,29,51,0.05), 0 16px 40px -16px rgba(11,29,51,0.16)",
        sheet: "0 -8px 40px -12px rgba(11,29,51,0.25)",
        goldGlow: "0 0 0 1px rgba(201,162,39,0.35), 0 8px 32px -12px rgba(201,162,39,0.45)",
      },
      transitionDuration: { DEFAULT: "240ms" },
      transitionTimingFunction: { DEFAULT: "cubic-bezier(0.4, 0.14, 0.3, 1)" },
      keyframes: {
        "fade-up": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "none" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-up": "fade-up 320ms cubic-bezier(0.4,0.14,0.3,1) both",
        shimmer: "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
