import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// __DEV_TOOLS__ (ADR 0013): the test menu, the dev URL parameters and the window.__game hook. On for `vite` (dev server, the
// playtests) and `vite build --mode devtools` (the Pages site); off for the plain `vite build`, the build that ships.
export default defineConfig(({ command, mode }) => ({
  // Relative paths so the build also works inside the Capacitor APK.
  base: './',
  plugins: [
    {
      // public/audio-candidates holds sounds and music staged for rating on the preview pages (tools/sound-preview). The game
      // never plays them, so they stay out of every build: about 16 MB of the APK.
      name: 'drop-audio-candidates',
      apply: 'build',
      closeBundle() {
        rmSync(resolve('dist', 'audio-candidates'), { recursive: true, force: true });
      },
    },
  ],
  define: {
    __DEV_TOOLS__: JSON.stringify(command === 'serve' || mode === 'devtools'),
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}));
