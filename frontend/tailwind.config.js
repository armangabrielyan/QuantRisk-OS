/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark financial terminal palette
        terminal: {
          bg: '#0f1117',
          panel: '#161b27',
          border: '#1e2635',
          text: '#e2e8f0',
          muted: '#64748b',
          accent: '#10b981',     // emerald green
          danger: '#ef4444',     // risk red
          warning: '#f59e0b',    // amber
          info: '#3b82f6',       // blue
          purple: '#8b5cf6',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
