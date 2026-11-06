import type { Config } from "tailwindcss";

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
        },
        main: "#202735",
        muted: {
          DEFAULT: "#F3F6FC",
          foreground: "#8992A3",
        },
        border: "#E8EDF4",
        income: {
          DEFAULT: "#269B72",
          light: "#EAF6F1",
        },
        expense: {
          DEFAULT: "#F07862",
          light: "#FDF1EE",
        },
        warning: {
          DEFAULT: "#E9B949",
          light: "#FEF8EC",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [],
};
export default config;
