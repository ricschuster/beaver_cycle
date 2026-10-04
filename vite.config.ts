import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative paths so the build also works inside the Capacitor APK.
  base: './',
  test: {
    include: ['src/**/*.test.ts'],
  },
});
