/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ww: {
          bg: '#0f172a',
          accent: '#38bdf8',
        },
      },
    },
  },
  plugins: [],
};
