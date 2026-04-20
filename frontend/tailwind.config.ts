import type { Config } from 'tailwindcss';

// Colours lifted from docs/InvoiceProcessing-screens/InvoiceProcessing_Wireframes_v1.0.html
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy:    { 900: '#0B1F35', 800: '#152D47', 700: '#1F4E79' },
        blue:    { 500: '#2E75B6', 300: '#5B9BD5', 100: '#DBEAFE' },
        accent:  { 600: '#E65100', 500: '#F57C00', 300: '#FF9800', 100: '#FFF3E0' },
        ink:     { 900: '#1E3347', 600: '#4A6780', 400: '#94B0C8', 100: '#EEF2F7', 50: '#F7F9FC' },
        success: { 500: '#2E7D32', 100: '#E8F5E9' },
        danger:  { 500: '#C62828', 100: '#FFEBEE' },
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(11,31,53,.12)',
      },
    },
  },
  plugins: [],
};

export default config;
