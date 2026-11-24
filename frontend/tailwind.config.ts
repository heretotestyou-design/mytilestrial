import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", md: "2rem" }, screens: { "2xl": "1240px" } },
    extend: {
      colors: {
        ink: { DEFAULT: "#12100E", 900: "#12100E", 800: "#1B1815", 700: "#26221E", 600: "#3A342E" },
        ivory: { DEFAULT: "#F6F2EB", 50: "#FBF9F5", 100: "#F6F2EB", 200: "#ECE5D9", 300: "#DCD2C2" },
        stone: { 400: "#A69B8C", 500: "#857A6C", 600: "#6A6055" },
        bronze: { DEFAULT: "#B08A5B", light: "#D2B48C", dark: "#8A6A42" },
        sage: "#8E9C88",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: { eyebrow: "0.22em" },
      boxShadow: {
        soft: "0 1px 2px rgba(18,16,14,.04), 0 12px 32px -12px rgba(18,16,14,.12)",
        lift: "0 2px 4px rgba(18,16,14,.06), 0 30px 60px -20px rgba(18,16,14,.25)",
        glow: "0 0 0 1px rgba(210,180,140,.25), 0 20px 60px -20px rgba(176,138,91,.45)",
      },
      keyframes: {
        shine: { "0%": { backgroundPosition: "200% 50%" }, "100%": { backgroundPosition: "-200% 50%" } },
        marquee: { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-10px)" } },
        aurora: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(4%,-3%,0) scale(1.08)" },
        },
      },
      animation: {
        shine: "shine 5s linear infinite",
        marquee: "marquee 40s linear infinite",
        float: "float 7s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
        "spin-slow": "spin 7s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
