/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        king: { 50: '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A', 300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706', 700: '#B45309', 800: '#92400E', 900: '#78350F' },
        accent: { 50: '#FFF7ED', 100: '#FFEDD5', 200: '#FED7AA', 300: '#FDBA74', 400: '#FB923C', 500: '#F97316', 600: '#EA580C', 700: '#C2410C' },
        success: { 50: '#ECFDF5', 100: '#D1FAE5', 400: '#34D399', 500: '#10B981', 600: '#059669', 700: '#047857' },
        warning: { 50: '#FFFBEB', 100: '#FEF3C7', 400: '#FBBF24', 500: '#F59E0B', 600: '#D97706' },
        error: { 50: '#FEF2F2', 100: '#FEE2E2', 400: '#F87171', 500: '#EF4444', 600: '#DC2626', 700: '#B91C1C' },
        surface: { light: '#FFFFFF', 'light-alt': '#FFFBEB', 'light-card': '#FEF9E7', dark: '#0A0A0A', 'dark-alt': '#141414', 'dark-card': '#1A1A1A', 'dark-border': '#2A2A2A' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Poppins', 'system-ui', 'sans-serif'] },
      animation: { 'fade-in': 'fadeIn 0.3s ease-in-out', 'slide-up': 'slideUp 0.3s ease-out', 'slide-in-right': 'slideInRight 0.3s ease-out', 'scale-in': 'scaleIn 0.2s ease-out', 'pulse-soft': 'pulseSoft 2s ease-in-out infinite', shimmer: 'shimmer 2s linear infinite' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideInRight: { '0%': { transform: 'translateX(20px)', opacity: '0' }, '100%': { transform: 'translateX(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        shimmer: { '0%': { backgroundPosition: '-1000px 0' }, '100%': { backgroundPosition: '1000px 0' } }
      }
    }
  },
  plugins: []
};
