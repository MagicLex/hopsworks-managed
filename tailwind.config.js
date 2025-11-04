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
            color: '#374151',
          },
          '50%': {
            color: '#10b981',
          },
        },
      },
      animation: {
        gradient: 'gradient 3s ease infinite',
        'matrix-char': 'matrix-char 2.5s steps(8) infinite',
      },
    },
  },
  plugins: [],
}