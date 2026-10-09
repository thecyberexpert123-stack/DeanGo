import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Orbitron', 'sans-serif'],
        headline: ['Orbitron', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'spin-slow': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.02)' },
        },
        'fade-in-out': {
          '0%': { opacity: '0' },
          '20%': { opacity: '1' },
          '80%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1', 'border-color': 'hsl(var(--accent) / 0.8)' },
          '50%': { opacity: '0.3', 'border-color': 'hsl(var(--accent) / 0.3)' },
        },
        'holographic-flicker': {
          '0%, 100%': { opacity: '1', 'border-color': 'hsl(var(--primary))' },
          '50%': { opacity: '0.6', 'border-color': 'hsl(var(--primary) / 0.5)' },
        },
        'orbit': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'breathing-glow': {
          '0%, 100%': {
            boxShadow: '0 0 50px 12px hsl(var(--primary) / 0.3), inset 0 0 15px hsl(var(--primary) / 0.4)',
            opacity: '0.9',
          },
          '50%': {
            boxShadow: '0 0 70px 18px hsl(var(--primary) / 0.5), inset 0 0 20px hsl(var(--primary) / 0.6)',
            opacity: '1',
          },
        },
        'scanner-line-rotate': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        'scanner-line-fade': {
          '0%, 100%': { opacity: '0' },
          '20%, 80%': { opacity: '1' },
        },
        'glyph-float': {
          '0%, 100%': { transform: 'translateY(-20px) rotate(-5deg)', opacity: '0.1' },
          '50%': { transform: 'translateY(20px) rotate(5deg)', opacity: '0.3' },
        },
        'speaking-ripple': {
          'from': { transform: 'scale(0.7)', opacity: '0.8' },
          'to': { transform: 'scale(1.6)', opacity: '0' },
        },
        'energy-pulse': {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '50%': { opacity: '0.3' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        'waveform-bar': {
          '0%, 100%': { height: '3px', opacity: '0.4' },
          '50%': { height: '15px', opacity: '1' },
        },
        'particle-drift': {
          from: { transform: 'translate(var(--x-start), var(--y-start))', opacity: '0' },
          '20%, 80%': { opacity: '1' },
          to: { transform: 'translate(var(--x-end), var(--y-end))', opacity: '0' },
        },
        'particle-suck-in': {
            'from': {
                transform: 'translate(var(--x-start), var(--y-start)) scale(1.2)',
                opacity: '1'
            },
            'to': {
                transform: 'translate(0, 0) scale(0)',
                opacity: '0'
            }
        },
        'particle-swirl': {
          from: { transform: 'rotate(0deg) scale(1)' },
          to: { transform: 'rotate(-360deg) scale(1.1)' }
        },
        'circuit-pulse': {
          '0%, 100%': { 'background-color': 'hsl(var(--primary)/0.05)' },
          '50%': { 'background-color': 'hsl(var(--primary)/0.15)' }
        },
        'boost-flash': {
          '0%': { opacity: '0' },
          '25%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        'vignette-pulse': {
            '0%, 100%': { opacity: '0' },
            '50%': { opacity: '0.7' },
        },
        'boot-grid-in': {
            'from': { opacity: '0' },
            'to': { opacity: '1' },
        },
        'boot-scanner': {
            '0%': { transform: 'translateY(-100%)', opacity: '0' },
            '10%': { opacity: '1' },
            '90%': { opacity: '1' },
            '100%': { transform: 'translateY(100%)', opacity: '0' },
        },
        'boot-screen-shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-2px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(2px)' },
        },
        'boot-phase-1-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'boot-phase-2-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'boot-phase-3-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'boot-phase-4-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'boot-path-draw': {
            to: { strokeDashoffset: '0' },
        },
        'boot-core-ignite': {
            '0%': { transform: 'scale(0)', opacity: '0', filter: 'brightness(1)' },
            '50%': { transform: 'scale(1.2)', opacity: '1', filter: 'brightness(2)' },
            '100%': { transform: 'scale(1)', opacity: '1', filter: 'brightness(1.5)' },
        },
        'boot-core-pulse': {
            '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
            '50%': { transform: 'scale(1.1)', opacity: '1' },
        },
        'boot-text-glitch': {
            '0%': { opacity: '0', transform: 'translateY(10px)' },
            '50%': { opacity: '0', transform: 'translateY(10px)' },
            '90%': { opacity: '1', transform: 'translateY(0)'},
            '92%': { opacity: '1', transform: 'translateX(-2px)' },
            '94%': { opacity: '0.5', transform: 'translateX(2px) skewX(20deg)' },
            '96%': { opacity: '1', transform: 'translateX(0) skewX(0)' },
            '100%': { opacity: '1' }
        },
        'boot-text-scanline': {
            'from': { transform: 'translateX(-100%)' },
            'to': { transform: 'translateX(100%)' },
        },
        'boot-log-appear': {
            'from': { opacity: '0' },
            'to': { opacity: '1' },
        },
        'log-scroll': {
            'from': { transform: 'translateY(100%)' },
            'to': { transform: 'translateY(0)' },
        },
        'boot-fade-out': {
            'from': { opacity: '0' },
            'to': { opacity: '1' },
        },
        'particle-stream': {
          '0%': {
            transform: 'rotate(var(--angle)) translateX(300px) scale(1.5)',
            opacity: '0',
          },
          '10%, 90%': { opacity: '1' },
          '100%': {
            transform: 'rotate(var(--angle)) translateX(45px) scale(0)',
            opacity: '0',
          },
        },
        'boot-shockwave-1': {
          '0%': { r: '40px', 'stroke-opacity': '1', strokeWidth: '5px' },
          '100%': { r: '250px', 'stroke-opacity': '0', strokeWidth: '0px' }
        },
        'boot-shockwave-2': {
          '0%': { r: '40px', 'stroke-opacity': '1' },
          '100%': { r: '300px', 'stroke-opacity': '0' }
        },
        'electric-flow': {
          'from': { 'stroke-dashoffset': 'var(--length, 200)' },
          '50%': { stroke: 'rgba(255, 255, 255, 0.8)', 'stroke-width': '2px' },
          'to': { 'stroke-dashoffset': '0' }
        },
        'particle-burst': {
          'from': {
            transform: 'rotate(var(--angle)) translateX(40px) scale(1)',
            opacity: '1',
          },
          '50%': { opacity: '1' },
          '100%': {
            transform: 'rotate(var(--angle)) translateX(200px) scale(0)',
            opacity: '0',
          },
        },
        'gyro-1': {
          from: { transform: 'rotateX(70deg) rotateZ(0deg)'},
          to: { transform: 'rotateX(70deg) rotateZ(1080deg)'}
        },
        'gyro-2': {
          from: { transform: 'rotateY(60deg) rotateZ(0deg)'},
          to: { transform: 'rotateY(60deg) rotateZ(-1440deg)'}
        },
        'gyro-3': {
          from: { transform: 'rotateX(-50deg) rotateY(20deg) rotateZ(0deg)'},
          to: { transform: 'rotateX(-50deg) rotateY(20deg) rotateZ(720deg)'}
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 1s cubic-bezier(0.215, 0.610, 0.355, 1.000) forwards',
        'spin-slow': 'spin-slow 25s linear infinite',
        'pulse-slow': 'pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-out': 'fade-in-out forwards',
        'flicker': 'flicker 2.5s linear infinite',
        'holographic-flicker': 'holographic-flicker 3s linear infinite',
        'orbit': 'orbit var(--duration, 20s) linear infinite var(--delay, 0s)',
        'breathing-glow': 'breathing-glow 4s ease-in-out infinite',
        'scanner-line-rotate': 'scanner-line-rotate var(--speed, 8s) linear infinite',
        'scanner-line-fade': 'scanner-line-fade calc(var(--speed, 8s) / 2) ease-in-out infinite',
        'glyph-float': 'glyph-float var(--duration, 5s) ease-in-out infinite alternate var(--delay, 0s)',
        'speaking-ripple': 'speaking-ripple 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'energy-pulse': 'energy-pulse 1.5s ease-out infinite',
        'waveform-bar': 'waveform-bar 0.8s ease-in-out infinite alternate',
        'particle-drift': 'particle-drift var(--duration, 20s) linear infinite alternate var(--delay, 0s)',
        'particle-suck-in': 'particle-suck-in forwards',
        'particle-swirl': 'particle-swirl 6s ease-in-out forwards',
        'circuit-pulse': 'circuit-pulse 5s ease-in-out infinite',
        'boost-flash': 'boost-flash 0.5s ease-out forwards',
        'vignette-pulse': 'vignette-pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) forwards',
        'boot-grid-in': 'boot-grid-in 1s 0s ease-out forwards',
        'boot-scanner': 'boot-scanner 1.5s 0.2s linear forwards',
        'boot-screen-shake': 'boot-screen-shake 0.3s 5.5s cubic-bezier(.36,.07,.19,.97) both',
        'boot-phase-1-in': 'boot-phase-1-in 0.5s 0.1s forwards',
        'boot-phase-2-in': 'boot-phase-2-in 0.5s 1s forwards',
        'boot-phase-3-in': 'boot-phase-3-in 0.5s 2.5s forwards',
        'boot-phase-4-in': 'boot-phase-4-in 0.5s 5s forwards',
        'boot-path-draw': 'boot-path-draw 2.5s ease-out forwards',
        'boot-core-ignite': 'boot-core-ignite 1.5s 5s ease-in-out forwards',
        'boot-core-pulse': 'boot-core-pulse 2s infinite ease-in-out 5.5s',
        'boot-text-glitch': 'boot-text-glitch 1.5s 6.5s forwards',
        'boot-text-scanline': 'boot-text-scanline 1s 7.3s ease-in-out',
        'boot-log-appear': 'boot-log-appear 0.5s 7s forwards',
        'log-scroll': 'log-scroll 1.5s ease-in-out forwards',
        'boot-fade-out': 'boot-fade-out 0.5s 7.5s linear forwards',
        'particle-stream': 'particle-stream var(--duration) ease-out var(--delay) forwards',
        'boot-shockwave-1': 'boot-shockwave-1 2s 5.5s ease-out forwards',
        'boot-shockwave-2': 'boot-shockwave-2 2.5s 5.6s ease-out forwards',
        'electric-flow': 'electric-flow 1.5s ease-in forwards',
        'particle-burst': 'particle-burst 2s ease-out forwards var(--delay, 0s)',
        'gyro-1': 'gyro-1 4s 2.5s ease-in-out forwards',
        'gyro-2': 'gyro-2 4s 2.8s ease-in-out forwards',
        'gyro-3': 'gyro-3 4s 3s ease-in-out forwards',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
