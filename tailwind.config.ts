import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF5FF',
          100: '#D9E8FF',
          200: '#BCDBFF',
          300: '#8EC5FF',
          400: '#58A4FF',
          500: '#2B7FFF',
          600: '#1A5FE8',
          700: '#1249C4',
          800: '#153E9E',
          900: '#17377D',
          950: '#0F224C',
        },
        health1: {
          teal: '#0D9488',
          navy: '#1B2A4A',
          coral: '#E8593C',
          amber: '#F59E0B',
          emerald: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
