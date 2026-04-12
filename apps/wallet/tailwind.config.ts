import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f0efff',    // Ink light bg
          100: '#e0d9ff',   // Light purple tint
          200: '#c4b5fd',   // Lighter purple
          300: '#a78bfa',   // Medium light purple
          400: '#8b5cf6',   // Medium purple
          500: '#7538F5',   // INK PRIMARY PURPLE (official brand color)
          600: '#6025d4',   // Darker purple
          700: '#4c1d95',   // Dark purple
          800: '#2e1065',   // Very dark purple
          900: '#160f1f',   // Ink dark bg (official brand dark)
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
