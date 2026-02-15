/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'imperial-gold': '#D4AF37',
        'imperial-red': '#CC0000',
        'xenos-purple': '#7D3C98',
        'chaos-black': '#0A0E27',
        'tech-red': '#8B0000',
        'parchment': '#F5E6D3',
      },
      fontFamily: {
        'warhammer': ['serif'],
      },
    },
  },
  plugins: [],
}
