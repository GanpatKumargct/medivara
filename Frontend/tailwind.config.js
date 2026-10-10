/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-contrast="high"]'],
  theme: {
    extend: {
      colors: {
        // Calm, clinical palette. Status colours are always paired with text + icon
        // in the UI; colour is never the only signal (SCR §1, NFR-A11Y-06).
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcdcff',
          300: '#8ec6ff',
          400: '#59a6ff',
          500: '#2f83f5',
          600: '#1b66db',
          700: '#1850b0',
          800: '#19448c',
          900: '#1a3c73',
        },
        ink: {
          DEFAULT: '#1a2230',
          muted: '#4b5566',
          subtle: '#6b7485',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f4f6fa',
          sunken: '#eceff5',
        },
        line: '#d8dde7',
        ok: { fg: '#1a6b3c', bg: '#e6f6ec', border: '#9fd9b4' },
        warn: { fg: '#8a5300', bg: '#fdf2e2', border: '#f0c983' },
        danger: { fg: '#a01423', bg: '#fdecee', border: '#f0a9b1' },
        info: { fg: '#1850b0', bg: '#e8f1ff', border: '#aecdfb' },
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      borderRadius: {
        xl: '0.875rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(26, 34, 48, 0.06), 0 1px 3px rgba(26, 34, 48, 0.08)',
        pop: '0 10px 30px rgba(26, 34, 48, 0.14)',
      },
    },
  },
  plugins: [],
}
