/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand cue from the existing marketing page (index.html)
        navy: {
          DEFAULT: '#030D28',
          800: '#0A1A3F',
          700: '#13245A',
        },
        accent: {
          DEFAULT: '#3B6FF5',
          600: '#2D59D0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
