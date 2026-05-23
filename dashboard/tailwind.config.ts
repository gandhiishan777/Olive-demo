import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { 50: "#FCF9F2", 100: "#FBF6EE", 200: "#F5EFE0", 300: "#EBE2CC" },
        burgundy: { 600: "#8C2333", 700: "#7B1F2B", 800: "#5C1620", 900: "#3F0F16" },
        ink: { 700: "#3a2e26", 900: "#1f1714" },
        leaf: { 600: "#3F7D5C", 700: "#2E5C42" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(63,15,22,0.05), 0 4px 12px rgba(63,15,22,0.06)",
      },
      keyframes: {
        pulseHighlight: {
          "0%": { backgroundColor: "rgba(140, 35, 51, 0.18)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "pulse-highlight": "pulseHighlight 3s ease-out 1",
      },
    },
  },
  plugins: [],
} satisfies Config;
