/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // фирменная акцентная палитра KIS
        kis: {
          accent: "#f7c948",
          up: "#34d399",
          down: "#f87171",
        },
      },
    },
  },
  plugins: [],
};
