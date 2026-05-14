/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#eff8ff",
          100: "#dbeffe",
          200: "#bedffd",
          300: "#91ccfc",
          400: "#5db0f8",
          500: "#0787ec",
          600: "#0670d1",
          700: "#065baa",
          800: "#0a4d8c",
          900: "#0e4174",
        },
        accent: {
          50: "#fefce8",
          100: "#fef9c3",
          200: "#fef08a",
          300: "#fde047",
          400: "#facc15",
          500: "#eab308",
          600: "#ca8a04",
          700: "#a16207",
          800: "#854d0e",
          900: "#713f12",
        },
        dark: {
          50: "#f6f6f6",
          100: "#e7e7e7",
          200: "#d1d1d1",
          300: "#b0b0b0",
          400: "#888888",
          500: "#6d6d6d",
          600: "#5d5d5d",
          700: "#4f4f4f",
          800: "#454545",
          900: "#212121",
          950: "#1a1a1a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "scan-wave": {
          "0%": { transform: "scale(0.55)", opacity: "0.9" },
          "100%": { transform: "scale(2.45)", opacity: "0" },
        },
        /** Brief white flash (camera metaphor) */
        "camera-flash": {
          "0%": { opacity: "0" },
          "12%": { opacity: "0.92" },
          "100%": { opacity: "0" },
        },
      },
      animation: {
        "scan-wave": "scan-wave 0.28s ease-out forwards",
        "camera-flash": "camera-flash 0.22s ease-out forwards",
      },
    },
  },
  plugins: [],
};
