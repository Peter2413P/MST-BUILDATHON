/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'var(--font-mono)', 'ui-monospace', 'monospace'],
        'label-code': ['JetBrains Mono', 'monospace'],
        'metric-num': ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Stitch Autonomous Agent Financial Grid Palette
        'bond-slashed': '#E63946',
        'surface-base-dark': '#0B0D0A',
        'surface-card-dark': '#151814',
        'surface-card-hover-dark': '#1D211B',
        'border-subtle-dark': '#292E27',
        'text-primary-dark': '#F5F7F2',
        'text-secondary-dark': '#8E9489',
        'text-muted-dark': '#555A52',

        'surface-base-light': '#F6F7F3',
        'surface-card-light': '#FFFFFF',
        'surface-elevated-light': '#F1F3ED',
        'border-subtle-light': '#E1E5DC',
        'text-primary-light': '#11130F',
        'text-secondary-light': '#5D6357',

        'status-success': '#B8FF00',
        'status-error': '#FF4D4D',
        'status-warning': '#FFB800',
        'status-info': '#00E5FF',

        // Lime & forest accents
        lime: {
          400: '#a8f000',
          DEFAULT: '#b8ff00',
          600: '#3d6a00',
          800: '#243600',
        },

        // Legacy compatibility
        amber: { DEFAULT: '#ef9f27' },
        sidebar: '#111113',
        chatbg: '#0c0c0e',
        cardbg: '#18181c',
        borderdim: '#242429',
        badgegreen: '#22c55e',
        bubble: '#1d1d22',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
        'ticker': 'ticker 28s linear infinite',
      },
      keyframes: {
        ticker: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
