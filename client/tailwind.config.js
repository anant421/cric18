/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F6F8FB',
        surface: '#FFFFFF',
        surface2: '#F1F5F9',
        border: '#E2E8F0',
        navy: {
          DEFAULT: '#0B1F3A',
          light: '#233A5E',
        },
        brand: {
          DEFAULT: '#155EEF',
          dark: '#0B4ECB',
          light: '#E8F0FE',
        },
        accent: {
          DEFAULT: '#0AAFC4',
          dark: '#088A9A',
          light: '#E3F8FA',
        },
        live: '#E11D48',
        gold: '#D4A72C',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        cardHover: '0 4px 12px rgba(16,24,40,0.08), 0 2px 4px rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
};
