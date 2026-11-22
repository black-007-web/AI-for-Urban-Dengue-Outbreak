const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        raised: v('raised'),
        ink: v('ink'),
        muted: v('muted'),
        line: v('line'),
        lagoon: v('lagoon'),
        coral: v('coral'),
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 1px 0 rgb(255 255 255 / 0.06) inset, 0 12px 40px -16px rgb(0 0 0 / 0.35)',
      },
    },
  },
  plugins: [],
};
