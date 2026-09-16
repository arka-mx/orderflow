import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: {
          DEFAULT: "#0f172a",
          secondary: "#1e293b",
          tertiary: "#334155",
        },
        bid: {
          DEFAULT: "#10b981", // emerald-500
          light: "#34d399",
          dark: "#065f46",
          bg: "rgba(16, 185, 129, 0.12)",
        },
        ask: {
          DEFAULT: "#f43f5e", // rose-500
          light: "#fb7185",
          dark: "#881337",
          bg: "rgba(244, 63, 94, 0.12)",
        },
      },
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },
    },
  },
  plugins: [],
};
export default config;
