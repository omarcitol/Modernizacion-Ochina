/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./renderer/index.html', './renderer/renderer.js'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        brand: '#2563eb',
        success: '#16a34a'
      }
    }
  },
  plugins: []
};
