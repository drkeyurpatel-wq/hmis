import type { Config } from 'tailwindcss';

/**
 * Health1 HMIS — Tailwind Configuration
 * Design System: Healthcare Accessible
 * Brand: Health1 Super Speciality Hospitals (yellow/red/teal cross + navy)
 * Reference: HMIS-SubProject1-Foundation-Spec-v1.1.md §4
 */
const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    screens: {
      sm: '375px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
    },
    extend: {
      colors: {
        // HEALTH1 BRAND TOKENS — from logo (yellow/red/teal cross + navy)
        'h1-navy': { DEFAULT: '#1A2E5A', light: '#E8EDF5' },
        'h1-teal': { DEFAULT: '#00A19A', light: '#E6F7F6' },
        'h1-red': { DEFAULT: '#D42B2B', light: '#FDE8E8' },
        'h1-yellow': { DEFAULT: '#E8A817', light: '#FEF6E0' },
        'h1-success': '#16A34A',
        'h1-bg': '#F8FAFC',
        'h1-card': '#FFFFFF',
        'h1-border': '#E2E8F0',
        'h1-text': { DEFAULT: '#1E293B', secondary: '#64748B', muted: '#94A3B8' },
        // LEGACY — deprecated, remove after page migration
        brand: {
          50: '#EEF5FF', 100: '#D9E8FF', 200: '#BCDBFF', 300: '#8EC5FF',
          400: '#58A4FF', 500: '#2B7FFF', 600: '#1A5FE8', 700: '#1249C4',
          800: '#153E9E', 900: '#17377D', 950: '#0F224C',
          teal: '#0D9488', navy: '#1B2A4A', coral: '#E8593C',
          amber: '#F59E0B', emerald: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Inter', 'Plus Jakarta Sans', 'DM Sans', 'sans-serif'],
      },
      fontSize: {
        'h1-title': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        'h1-section': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'h1-card-title': ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        'h1-body': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],
        'h1-small': ['0.75rem', { lineHeight: '1rem', fontWeight: '400' }],
        'h1-data': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
      },
      spacing: {
        'h1-xs': '0.25rem', 'h1-sm': '0.5rem', 'h1-md': '1rem',
        'h1-lg': '1.5rem', 'h1-xl': '2rem',
      },
      borderRadius: { 'h1': '0.5rem', 'h1-sm': '0.375rem', 'h1-lg': '0.75rem' },
      boxShadow: {
        'h1-card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'h1-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.07)',
        'h1-modal': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: { 'h1-fast': '150ms', 'h1-normal': '200ms', 'h1-slow': '300ms' },
      keyframes: {
        'h1-shimmer': { '0%': { opacity: '0.5' }, '50%': { opacity: '1' }, '100%': { opacity: '0.5' } },
        'h1-slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'h1-fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'h1-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        'h1-shimmer': 'h1-shimmer 1.5s ease-in-out infinite',
        'h1-slide-in': 'h1-slide-in-right 300ms ease-out',
        'h1-fade-in': 'h1-fade-in 200ms ease-out',
        'h1-shake': 'h1-shake 400ms ease-in-out',
      },
    },
  },
  plugins: [],
};

export default config;
