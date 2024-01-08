import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        primary: "hsl(var(--primary))",
        "primary-foreground": "hsl(var(--primary-foreground))",
        muted: "hsl(var(--muted))",
        "muted-foreground": "hsl(var(--muted-foreground))",
        border: "hsl(var(--border))",
        ring: "hsl(var(--ring))",
        warning: "hsl(var(--warning))",
        "warning-foreground": "hsl(var(--warning-foreground))"
      },
      borderRadius: {
        lg: "0.9rem",
        md: "calc(0.9rem - 2px)",
        sm: "calc(0.9rem - 4px)"
      },
      boxShadow: {
        soft: "0 20px 50px -30px rgba(15, 23, 42, 0.5)"
      }
    }
  },
  plugins: []
};

export default config;
