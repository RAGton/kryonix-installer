export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg': '#08111f',
        'bg-elevated': '#0d1728',
        'bg-surface': '#111c31',
        'bg-glass': 'rgba(13, 23, 40, 0.65)',
        'bg-light': '#f4f7fb',
        'bg-light-glass': 'rgba(255, 255, 255, 0.7)',
        'border-subtle': '#1e293b',
        'border-active': '#3b82f6',
        'text-primary': '#f3f7fb',
        'text-secondary': '#a8b3c7',
        'text-muted': '#475569',
        'accent-blue': '#3b82f6',
        'accent-cyan': '#38bdf8',
        'success': '#10b981',
        'warning': '#f59e0b',
        'danger': '#ef4444',
      },
      spacing: {
        'shell': '2rem',
        'panel': '1.5rem',
        'card': '1rem',
        'section': '2.5rem',
      },
      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.5)',
        'panel': '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
        'danger': '0 4px 20px -2px rgba(239, 68, 68, 0.3)',
        'focus': '0 0 0 2px rgba(59, 130, 246, 0.5)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
