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
    },
  },
  plugins: [],
}