import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: {
    colors: { ink: { 50: '#f0efff', 100: '#e0d9ff', 200: '#c4b5fd', 300: '#a78bfa', 400: '#8b5cf6', 500: '#7538F5', 600: '#6025d4', 700: '#4c1d95', 800: '#2e1065', 900: '#160f1f' } },
    fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
  }},
  plugins: [],
};
export default config;
