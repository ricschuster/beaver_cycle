import { defineConfig } from '@playwright/test';

// The release build, served as it ships (ADR 0013): `npm run build` first, then `npm run test:release`. The playtests in
// tests/e2e run on the dev server, where the test menu and window.__game exist; these check the build a player gets.
const port = process.env.RELEASE_PORT ?? '5290';

export default defineConfig({
  testDir: 'tests/release',
  webServer: {
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: `http://localhost:${port}` },
});
