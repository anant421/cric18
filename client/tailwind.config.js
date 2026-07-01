/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F1E8',
        surface: '#FFFFFF',
        surface2: '#F0EBDF',
        border: '#E4DFD2',
        navy: {
          DEFAULT: '#111111',
          light: '#3A3A3A',
        },
        brand: {
          DEFAULT: '#FFC800',
          dark: '#E0AD00',
          light: '#FFF6DA',
        },
        accent: {
          DEFAULT: '#111111',
          dark: '#000000',
          light: '#F0EBDF',
        },
        live: '#E11D48',
        // Darker than `brand` - used for readable text/numbers on light
        // backgrounds, where the bright button-yellow fails contrast.
        gold: '#8A6D00',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        cardHover: '0 4px 12px rgba(16,24,40,0.08), 0 2px 4px rgba(16,24,40,0.06)',
      },
    },
  },
  plugins: [],
};
