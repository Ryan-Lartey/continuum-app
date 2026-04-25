/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        amber: {
          500: '#f97316',
          600: '#ea6c0a',
        },
        orange: {
          400: '#fb923c',
          500: '#f97316',
          600: '#ea6c0a',
        },
      },
      borderRadius: {
        'none': '0',
        'sm':   '3px',
        DEFAULT:'4px',
        'md':   '5px',
        'lg':   '6px',
        'xl':   '8px',
        '2xl':  '10px',
        '3xl':  '14px',
        'full': '9999px',
      },
      boxShadow: {
        'glow-sm':  '0 0 12px rgba(249,115,22,0.15)',
        'glow':     '0 0 24px rgba(249,115,22,0.2)',
        'glow-lg':  '0 0 40px rgba(249,115,22,0.25)',
        'card':     '0 4px 24px rgba(0,0,0,0.4)',
        'elevated': '0 8px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'shimmer':    'shimmer 2s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(249,115,22,0.15)' },
          '50%':      { boxShadow: '0 0 28px rgba(249,115,22,0.35)' },
        },
      },
      backdropBlur: {
        'xs': '2px',
      },
    },
  },
  plugins: [],
}
