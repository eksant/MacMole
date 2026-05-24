/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // shadcn/ui CSS-variable tokens
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // App custom colors
        surface: {
          DEFAULT: "rgba(255,255,255,0.03)",
          hover:   "rgba(255,255,255,0.05)",
          border:  "rgba(255,255,255,0.06)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      backgroundImage: {
        "grad-purple": "linear-gradient(135deg, #8b5cf6, #6366f1)",
        "grad-blue":   "linear-gradient(135deg, #3b82f6, #0ea5e9)",
        "grad-pink":   "linear-gradient(135deg, #ec4899, #a855f7)",
        "grad-teal":   "linear-gradient(135deg, #14b8a6, #3b82f6)",
        "grad-amber":  "linear-gradient(135deg, #f59e0b, #ef4444)",
      },
      animation: {
        "spin-ring":       "spinner-rotate 1s linear infinite",
        "fade-in-up":      "fade-in-up 0.35s ease-out",
        "pulse-glow":      "pulse-glow 2s ease-in-out infinite",
        "score-ring":      "score-ring 1.2s cubic-bezier(0.4,0,0.2,1) forwards",
        "accordion-down":  "accordion-down 0.2s ease-out",
        "accordion-up":    "accordion-up 0.2s ease-out",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to:   { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to:   { height: "0" },
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
