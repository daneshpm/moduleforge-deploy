/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#F7F8F7',
        foreground: '#202524',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#202524',
        },
        border: '#E2E6E4',
        input: '#E2E6E4',
        ring: '#1F5E4B',
        primary: {
          DEFAULT: '#1F5E4B',
          foreground: '#FFFFFF',
          hover: '#174739',
          dark: '#12372C',
          light: '#28755E',
          50: '#F2F7F5',
          100: '#EAF3EF',
          200: '#D1E6DC',
          300: '#A8D0BE',
          400: '#61A58A',
          500: '#1F5E4B',
          600: '#194E3E',
          700: '#143E32',
          800: '#0F2E25',
          900: '#0A1F19',
        },
        secondary: {
          DEFAULT: '#EAF3EF',
          foreground: '#1F5E4B',
          hover: '#DBECE3',
        },
        brand: {
          bg: '#F7F8F7',
          card: '#FFFFFF',
          text: '#202524',
          muted: '#6B7471',
          border: '#E2E6E4',
          success: '#2E7D5B',
          danger: '#C94A4A',
          primary: '#1F5E4B',
          secondary: '#EAF3EF',
        },
        success: {
          DEFAULT: '#2E7D5B',
          foreground: '#FFFFFF',
          50: '#F0F9F5',
          100: '#E0F3EA',
          500: '#2E7D5B',
          600: '#246549',
        },
        danger: {
          DEFAULT: '#C94A4A',
          foreground: '#FFFFFF',
          50: '#FDF3F3',
          100: '#FBE6E6',
          500: '#C94A4A',
          600: '#A83B3B',
        },
        slate: {
          50: '#F7F8F7',
          100: '#EAF3EF',
          200: '#E2E6E4',
          300: '#C8D0CD',
          400: '#94A09C',
          500: '#6B7471',
          600: '#525B58',
          700: '#3A423F',
          800: '#282F2C',
          900: '#202524',
          950: '#141817',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03)',
        'card': '0 2px 8px -2px rgba(31, 94, 75, 0.06), 0 1px 4px -1px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 12px 28px -6px rgba(31, 94, 75, 0.14), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
        'glow-primary': '0 0 20px rgba(31, 94, 75, 0.25)',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.25s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        }
      }
    },
  },
  plugins: [],
}
