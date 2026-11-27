/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        pilot: {
          green: '#25D366',
          ink: '#0F172A',
          violet: '#7C3AED',
          night: '#020617',
          card: '#0B1220',
          muted: '#94A3B8',
        },
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        glow: '0 0 80px rgb(37 211 102 / 18%)',
        panel: '0 24px 80px rgb(2 6 23 / 35%)',
      },
    },
  },
  plugins: [],
};
