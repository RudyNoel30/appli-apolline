/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#F3F5FA',
          100: '#E3E8F2',
          200: '#BEC9DF',
          300: '#8498BC',
          400: '#4F6696',
          500: '#2E4779',
          600: '#1F3A7A',
          700: '#142B5C',
          800: '#0F2249',
          900: '#0A1F3D',
          950: '#06122A',
        },
        gold: {
          50:  '#FBF7EC',
          100: '#F6EED3',
          200: '#ECDBA2',
          300: '#E5C875',
          400: '#D4BA7A',
          500: '#C9A961',
          600: '#B08B3F',
          700: '#8A6B2E',
          800: '#5E4820',
          900: '#3A2D14',
        },
        ivory: '#F8F7F3',
        parchment: '#FAF8F1',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgba(10,31,61,.04), 0 1px 3px 0 rgba(10,31,61,.06)',
        'card': '0 1px 3px 0 rgba(10,31,61,.06), 0 4px 12px -4px rgba(10,31,61,.08)',
        'raised': '0 4px 16px -4px rgba(10,31,61,.12), 0 8px 32px -8px rgba(10,31,61,.08)',
        'gold': '0 4px 14px -4px rgba(201,169,97,.35)',
      },
      borderRadius: {
        'xl2': '14px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.75', transform: 'scale(1.15)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(201,169,97,0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(201,169,97,0)' },
        },
        'indicator-in': {
          '0%': { opacity: '0', transform: 'scaleY(0)' },
          '100%': { opacity: '1', transform: 'scaleY(1)' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 350ms ease-out both',
        'fade-in-up': 'fade-in-up 450ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in-down': 'fade-in-down 300ms ease-out both',
        'slide-in-right': 'slide-in-right 400ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 300ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2.4s ease-in-out infinite',
        'indicator-in': 'indicator-in 250ms ease-out both',
        'count-up': 'count-up 500ms ease-out both',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
