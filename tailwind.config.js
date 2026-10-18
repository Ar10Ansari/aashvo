/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#F5F3ED',
          50: '#FDFCFB',
          100: '#FAF8F5',
          200: '#F5F3ED',
          300: '#EBE7DD',
          400: '#DED8C7',
        },
        forest: {
          DEFAULT: '#244737',
          50: '#F0F5F2',
          100: '#DCE8E1',
          200: '#B8D1C3',
          300: '#8FB5A0',
          400: '#4A6B5D',
          500: '#345E4A',
          600: '#244737',
          700: '#1B372A',
          800: '#14291F',
          900: '#0C1A14',
        },
        sand: {
          DEFAULT: '#D9B98C',
          50: '#FBF8F3',
          100: '#F5EEE2',
          200: '#EBDEC9',
          300: '#E2CEAF',
          400: '#D9B98C',
          500: '#C7A26F',
          600: '#B08852',
          700: '#8C693B',
          800: '#694E2C',
        },
        charcoal: {
          DEFAULT: '#292D2A',
          50: '#F6F6F6',
          100: '#E7E8E7',
          200: '#CFD1D0',
          300: '#A7ABA8',
          400: '#6B716D',
          500: '#474D49',
          600: '#292D2A',
          700: '#202321',
          800: '#181A19',
          900: '#0F100F',
        },
        fresh: '#16A34A',
        amberWarm: '#D97706',
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 20px -2px rgba(41, 45, 42, 0.05)',
        'lift': '0 10px 25px -4px rgba(41, 45, 42, 0.08)',
        'card': '0 2px 12px 0 rgba(41, 45, 42, 0.04)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      }
    },
  },
  plugins: [],
}
