/** @type {import('tailwindcss').Config} */
const { quartzPreset } = require('tailwind-quartz/tailwind-preset');

module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './node_modules/tailwind-quartz/dist/**/*.js',
  ],
  theme: {
    extend: {
      ...quartzPreset.theme.extend,
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'matrix-char': {
          '0%, 19.9%': { color: '#022c22' },
          '20%, 39.9%': { color: '#064e3b' },
          '40%, 59.9%': { color: '#047857' },
          '60%, 79.9%': { color: '#059669' },
          '80%, 99.9%': { color: '#10b981' },
          '100%': { color: '#022c22' },
        },
      },
      animation: {
        gradient: 'gradient 3s ease infinite',
        'matrix-char': 'matrix-char 1s infinite',
      },
    },
  },
  plugins: [],
}