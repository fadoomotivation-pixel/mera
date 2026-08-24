import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef6ee",
          100: "#fdead4",
          200: "#fad2a8",
          400: "#f5a24a",
          600: "#c9711f",
          700: "#a2591a",
          800: "#7c451a",
          900: "#5c3517",
        },
        ink: {
          900: "#1a1410",
          700: "#3a2f27",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
