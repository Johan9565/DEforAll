/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{html,js,ts,css}'],
  // Library + pagination: never inject a global CSS reset.
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        ribbon: {
          bg: '#f3f4f6',
          line: '#d1d5db',
          accent: '#2563eb',
          title: '#1d4ed8',
          titleHover: '#1e40af',
        },
      },
      fontFamily: {
        doc: ['"Times New Roman"', 'Times', 'Georgia', 'serif'],
        monoDoc: ['"Courier New"', 'monospace'],
        ui: ['"Segoe UI"', 'Segoe UI Variable', 'system-ui', 'sans-serif'],
      },
      spacing: {
        ribbon: '4.25rem',
      },
    },
  },
  plugins: [],
};
