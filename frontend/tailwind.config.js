/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "rgba(255,255,255,0.05)",
          hover:   "rgba(255,255,255,0.09)",
          border:  "rgba(255,255,255,0.10)",
        },
        purple: {
          450: "#a855f7",
          550: "#7c3aed",
        },
      },
      backgroundImage: {
        "grad-purple": "linear-gradient(135deg, #8b5cf6, #6366f1)",
        "grad-blue":   "linear-gradient(135deg, #3b82f6, #0ea5e9)",
        "grad-pink":   "linear-gradient(135deg, #ec4899, #a855f7)",
        "grad-teal":   "linear-gradient(135deg, #14b8a6, #3b82f6)",
        "grad-amber":  "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
      animation: {
        "spin-ring":     "spinner-rotate 1s linear infinite",
        "fade-in-up":    "fade-in-up 0.35s ease-out",
        "pulse-glow":    "pulse-glow 2s ease-in-out infinite",
        "score-ring":    "score-ring 1.2s cubic-bezier(0.4,0,0.2,1) forwards",
      },
    },
  },
  plugins: [],
};
