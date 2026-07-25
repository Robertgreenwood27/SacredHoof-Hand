import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Sacred Hoof & Hand palette
        ivory: "#F7F3EC",
        sage: "#A8B2A1",
        // Dark enough for readable body-size text and ivory button labels.
        terracotta: "#95513F",
        gold: "#D6B56D",
        charcoal: "#3A3A3A",
      },
      fontFamily: {
        // Network-free stacks keep production builds deterministic.
        heading: ["Georgia", "Cambria", "Times New Roman", "serif"],
        body: ["Segoe UI", "Arial", "sans-serif"],
      },
      maxWidth: {
        content: "72rem",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.8s ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
