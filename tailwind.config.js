/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#1a202c', // Dark background
        'secondary': '#2d3748', // Slightly lighter dark
        'accent': '#4fd1c5', // Teal accent
        'text-primary': '#e2e8f0', // Light gray text
        'text-secondary': '#a0aec0', // Medium gray text
        'highlight': '#f6e05e', // Yellow highlight for scheduled
        'success': '#68d391', // Green for completed
        'interactive': '#63b3ed', // Blue for interactive elements
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
