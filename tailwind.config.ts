import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#08090b",
        surface: {
          50: "#181a20",
          100: "#14161b",
          200: "#0f1115",
          300: "#0b0c10",
          elevated: "#191c24",
          card: "rgba(18, 21, 28, 0.65)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          light: "rgba(255, 255, 255, 0.12)",
          focus: "rgba(255, 255, 255, 0.28)",
        },
        accent: {
          silver: "#e4e4e7",
          muted: "#71717a",
          glow: "#38bdf8",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "Geist Mono",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "subtle-glow": "subtleGlow 6s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "slide-up": "slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        shake: "shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
      },
      keyframes: {
        subtleGlow: {
          "0%": { opacity: "0.4", transform: "scale(0.98)" },
          "100%": { opacity: "0.8", transform: "scale(1.02)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shake: {
          "10%, 90%": { transform: "translate3d(-2px, 0, 0)" },
          "20%, 80%": { transform: "translate3d(3px, 0, 0)" },
          "30%, 50%, 70%": { transform: "translate3d(-4px, 0, 0)" },
          "40%, 60%": { transform: "translate3d(4px, 0, 0)" },
        },
      },
      boxShadow: {
        "glow-sm": "0 0 20px -5px rgba(255, 255, 255, 0.08)",
        "glow-md": "0 0 35px -5px rgba(255, 255, 255, 0.12)",
        "glow-accent": "0 0 40px -10px rgba(56, 189, 248, 0.18)",
        "inner-light": "inset 0 1px 1px 0 rgba(255, 255, 255, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;

