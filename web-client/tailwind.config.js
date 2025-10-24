/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#667eea',
          dark: '#764ba2',
        },
        tetris: {
          bg: '#1a1a2e',
          card: '#2a2a3e',
        }
      },
      animation: {
        'pulse-target': 'pulse 1.5s infinite',
      }
    },
  },
  plugins: [],
}
