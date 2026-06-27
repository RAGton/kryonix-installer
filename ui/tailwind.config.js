export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg': '#0B0F19', // Deep sci-fi space blue
        'bg-elevated': '#111827', // slightly lighter panel
        'bg-glass': 'rgba(17, 24, 39, 0.65)',
        'border-subtle': '#1F2937',
        'border-active': '#3B82F6',
        'text-primary': '#F9FAFB',
        'text-secondary': '#9CA3AF',
        'text-muted': '#4B5563',
        'accent-blue': '#3B82F6',
        'accent-cyan': '#06B6D4',
        'success': '#10B981',
        'warning': '#F59E0B',
        'danger': '#EF4444',
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
