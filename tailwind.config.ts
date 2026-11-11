import type { Config } from "tailwindcss";

/**
 * Spendly light theme tokens. Brand values are unchanged; `*.text` shades are
 * same-hue variants used for text so it meets WCAG AA (≥4.5:1) on white and
 * on the #F3F6FC page background. Fills, icons and borders keep the brand DEFAULT.
 */
const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F3F6FC",
        card: {
          DEFAULT: "#FFFFFF",
          foreground: "#202735",
        },
        primary: {
          DEFAULT: "#2878E5",
          foreground: "#FFFFFF",
          hover: "#1F65C2",
          light: "#EBF3FC",
          text: "#1B6DDE",
        },
        main: "#202735",
        muted: {
          DEFAULT: "#F3F6FC",
          // was #8992A3 (3.1:1) — deepened for AA readability, same cool grey family
          foreground: "#667083",
          subtle: "#8992A3",
        },
        border: {
          DEFAULT: "#E8EDF4",
          strong: "#D5DDE8",
        },
        income: {
          DEFAULT: "#269B72",
          light: "#EAF6F1",
          hover: "#208461",
          text: "#1F805E",
        },
        expense: {
          DEFAULT: "#F07862",
          light: "#FDF1EE",
          hover: "#D9634E",
          text: "#BF4A35",
        },
        warning: {
          DEFAULT: "#E9B949",
          light: "#FEF8EC",
          foreground: "#735B1B",
        },
      },
      borderRadius: {
        xl: "0.875rem",
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(32 39 53 / 0.04), 0 1px 3px 0 rgb(32 39 53 / 0.03)",
        "card-hover": "0 4px 12px -2px rgb(32 39 53 / 0.08), 0 2px 4px -2px rgb(32 39 53 / 0.04)",
        popover: "0 10px 30px -8px rgb(32 39 53 / 0.18), 0 2px 6px -2px rgb(32 39 53 / 0.06)",
      },
      fontVariantNumeric: {},
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 150ms ease-out",
        "slide-up": "slide-up 180ms ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
