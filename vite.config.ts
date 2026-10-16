import { defineConfig } from 'vitest/config';

// __DEV_TOOLS__ (ADR 0013): the test menu, the dev URL parameters and the window.__game hook. On for `vite` (dev server, the
// playtests) and `vite build --mode devtools` (the Pages site); off for the plain `vite build`, the build that ships.
export default defineConfig(({ command, mode }) => ({
  // Relative paths so the build also works inside the Capacitor APK.
  base: './',
  define: {
    __DEV_TOOLS__: JSON.stringify(command === 'serve' || mode === 'devtools'),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
