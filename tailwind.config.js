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
        }
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
    },
  },
  plugins: [],
}
