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
          '0%, 100%': {
            color: '#374151', // gray
          },
          '25%': {
            color: '#10b981', // green
          },
          '50%': {
            color: '#06b6d4', // cyan
          },
          '75%': {
            color: '#8b5cf6', // purple
          },
        },
      },
      animation: {
        gradient: 'gradient 3s ease infinite',
        'matrix-char': 'matrix-char 2s steps(4) infinite',
      },
    },
  },
  plugins: [],
}