/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#0F6E56',
          'teal-light': '#12856A',
          'teal-dark': '#0B5A46',
          dark: '#1A1A2E',
        },
        swap: {
          coral: '#FF6B6B',
          'coral-bg': '#FFF0F0',
          amber: '#F59E0B',
          'amber-bg': '#FFFBEB',
          purple: '#8B5CF6',
          'purple-bg': '#F5F3FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
