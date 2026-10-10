/** @type {import('tailwindcss').Config} */
// Medivara design system. Token NAMES are kept stable (brand/ink/surface/line/
// ok/warn/danger/info) so every component re-skins from here with no churn.
// Official palette: navy #0B3B8C · tech blue #0284F7 · cyan #06B6D4 ·
// teal #10B981 · fresh green #34D399 · bg #F8FAFC · text #1F2937 / #64748B ·
// borders #E2E8F0.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-contrast="high"]'],
  theme: {
    extend: {
      colors: {
        // Primary brand ramp: tech blue → navy. 500/600 = actions, 900 = navy headings.
        // Themeable via CSS variables (index.css): blue by default, rose for data-theme="rose".
        brand: {
          50: 'rgb(var(--mv-brand-50) / <alpha-value>)',
          100: 'rgb(var(--mv-brand-100) / <alpha-value>)',
          200: 'rgb(var(--mv-brand-200) / <alpha-value>)',
          300: 'rgb(var(--mv-brand-300) / <alpha-value>)',
          400: 'rgb(var(--mv-brand-400) / <alpha-value>)',
          500: 'rgb(var(--mv-brand-500) / <alpha-value>)',
          600: 'rgb(var(--mv-brand-600) / <alpha-value>)',
          700: 'rgb(var(--mv-brand-700) / <alpha-value>)',
          800: 'rgb(var(--mv-brand-800) / <alpha-value>)',
          900: 'rgb(var(--mv-brand-900) / <alpha-value>)',
        },
        // Cyan accent + teal/green for positive highlights (used via `ok`).
        accent: { DEFAULT: '#06B6D4', soft: '#34D399' },
        ink: {
          DEFAULT: '#1F2937',
          muted: '#475569',
          subtle: '#64748B',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
          sunken: '#EDF3FB',
        },
        line: '#E2E8F0',
        // Calm, Claude-desktop-style app chrome: a warm-neutral canvas and sidebar
        // so the brand blue is reserved for actions and highlights.
        canvas: {
          DEFAULT: 'rgb(var(--mv-canvas) / <alpha-value>)',
          sidebar: 'rgb(var(--mv-canvas-sidebar) / <alpha-value>)',
          hover: 'rgb(var(--mv-canvas-hover) / <alpha-value>)',
          active: 'rgb(var(--mv-canvas-active) / <alpha-value>)',
          border: 'rgb(var(--mv-canvas-border) / <alpha-value>)',
          bubble: 'rgb(var(--mv-canvas-bubble) / <alpha-value>)',
        },
        ok: { fg: '#0F7A54', bg: '#E6F8F0', border: '#9EE3C4' },
        warn: { fg: '#8A5300', bg: '#FDF2E2', border: '#F0C983' },
        danger: { fg: '#B0152A', bg: '#FDECEE', border: '#F0A9B1' },
        info: { fg: '#0B57B0', bg: '#E6F4FF', border: '#A6D2FD' },
        // Full logo palette as categorical tints (never used to judge values).
        cyan: { fg: '#0E7490', bg: '#E0F7FB', border: '#A5E8F2' },
        teal: { fg: '#0F766E', bg: '#E3F7F2', border: '#9DE6D6' },
        green: { fg: '#0F7A54', bg: '#E6F8F0', border: '#9EE3C4' },
        violet: { fg: '#5B46C9', bg: '#EEEBFB', border: '#CFC6F3' },
      },
      backgroundImage: {
        // Use sparingly: primary CTAs, selected highlights, brand surfaces.
        'brand-gradient': 'linear-gradient(135deg, var(--mv-grad-from) 0%, var(--mv-grad-to) 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, var(--mv-grad-soft-from) 0%, var(--mv-grad-soft-to) 100%)',
        'hero-fade': 'linear-gradient(180deg, rgb(var(--mv-brand-50)) 0%, rgb(var(--mv-canvas)) 100%)',
        // Categorical gradients across the full logo range.
        'grad-blue': 'linear-gradient(135deg, #0284F7 0%, #0B3B8C 100%)',
        'grad-cyan': 'linear-gradient(135deg, #22C3E6 0%, #0284F7 100%)',
        'grad-teal': 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
        'grad-green': 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
        'grad-violet': 'linear-gradient(135deg, #818CF8 0%, #5B46C9 100%)',
      },
      fontFamily: {
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
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
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 6px rgba(15, 23, 42, 0.06)',
        pop: '0 12px 34px rgb(var(--mv-brand-900) / 0.16)',
        brand: '0 8px 20px rgb(var(--mv-brand-500) / 0.22)',
        composer: '0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 24px rgba(15, 23, 42, 0.07)',
      },
    },
  },
  plugins: [],
}
